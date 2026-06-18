require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

// 1. Setup Client
const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

// 2. Database Setup (Loads from database.json)
const dbPath = path.join(__dirname, 'database.json');
let db = { matches: {}, players: {} };

if (fs.existsSync(dbPath)) {
    db = JSON.parse(fs.readFileSync(dbPath));
} else {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function saveDB() {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

// 3. Define ALL Commands
const commands = [
    new SlashCommandBuilder().setName('match').setDescription('Manage Conflict of Nations matches')
        .addSubcommand(sub => sub.setName('create').setDescription('Create a match channel, role, and ID')
            .addStringOption(opt => opt.setName('game-id').setDescription('The CoN Game ID').setRequired(true))
            .addBooleanOption(opt => opt.setName('open-search').setDescription('Post a public Join card?')))
        .addSubcommand(sub => sub.setName('set-type').setDescription('Set game mode and speed')
            .addStringOption(opt => opt.setName('game-id').setDescription('The Match ID').setRequired(true))
            .addStringOption(opt => opt.setName('mode').setDescription('e.g. Normal, Ranked').setRequired(true))
            .addStringOption(opt => opt.setName('speed').setDescription('e.g. 1x, 2x').setRequired(true)))
        .addSubcommand(sub => sub.setName('set-country').setDescription('Set your country')
            .addStringOption(opt => opt.setName('game-id').setDescription('The Match ID').setRequired(true))
            .addStringOption(opt => opt.setName('country').setDescription('Your country').setRequired(true)))
        .addSubcommand(sub => sub.setName('country-list').setDescription('Show match details')
            .addStringOption(opt => opt.setName('game-id').setDescription('The Match ID').setRequired(true)))
        .addSubcommand(sub => sub.setName('add').setDescription('Add a player')
            .addStringOption(opt => opt.setName('game-id').setDescription('The Match ID').setRequired(true))
            .addUserOption(opt => opt.setName('player').setDescription('Player to add').setRequired(true)))
        .addSubcommand(sub => sub.setName('remove').setDescription('Remove a player')
            .addStringOption(opt => opt.setName('game-id').setDescription('The Match ID').setRequired(true))
            .addUserOption(opt => opt.setName('player').setDescription('Player to remove').setRequired(true)))
        .addSubcommand(sub => sub.setName('transfer-host').setDescription('Transfer host')
            .addStringOption(opt => opt.setName('game-id').setDescription('The Match ID').setRequired(true))
            .addUserOption(opt => opt.setName('new-host').setDescription('New host').setRequired(true)))
        .addSubcommand(sub => sub.setName('open-search').setDescription('Reopen join card')
            .addStringOption(opt => opt.setName('game-id').setDescription('The Match ID').setRequired(true)))
        .addSubcommand(sub => sub.setName('close-search').setDescription('Close join card')
            .addStringOption(opt => opt.setName('game-id').setDescription('The Match ID').setRequired(true)))
        .addSubcommand(sub => sub.setName('leave').setDescription('Leave match')
            .addStringOption(opt => opt.setName('game-id').setDescription('The Match ID').setRequired(true)))
        .addSubcommand(sub => sub.setName('close').setDescription('End match and record stats')
            .addStringOption(opt => opt.setName('game-id').setDescription('The Match ID').setRequired(true))
            .addStringOption(opt => opt.setName('result').setDescription('Your result').setRequired(true)
                .addChoices({ name: 'Win', value: 'win' }, { name: 'Loss', value: 'loss' }, { name: 'Draw', value: 'draw' })))
        .addSubcommand(sub => sub.setName('stats').setDescription('View real player stats')
            .addUserOption(opt => opt.setName('player').setDescription('Player to check').setRequired(true)))
].map(cmd => cmd.toJSON());

// 4. Register Commands
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
(async () => {
    try {
        console.log('⚔️  Refreshing commands...');
        const guildId = '1517155049288241282'; 
        await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId), { body: commands });
        console.log('✅ Commands reloaded.');
    } catch (error) { console.error(error); }
})();

// 5. Bot Logic
client.on('ready', () => {
    console.log(`✅ Sword Bot Online | Matches Loaded: ${Object.keys(db.matches).length}`);
    client.user.setActivity('Conflict of Nations', { type: 2 });
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'match') return;

    const sub = interaction.options.getSubcommand();
    const gameId = interaction.options.getString('game-id') || (sub === 'create' ? interaction.options.getString('game-id') : null);
    const user = interaction.user;
    const guild = interaction.guild;

    // Helper to check host
    const isHost = (id) => db.matches[id] && db.matches[id].hostId === user.id;

    try {
        // --- CREATE MATCH ---
        if (sub === 'create') {
            const id = interaction.options.getString('game-id');
            if (db.matches[id]) return interaction.reply({ content: '❌ Match ID already exists!', ephemeral: true });

            // 1. Create Role
            const roleName = `Match-${id}`;
            const role = await guild.roles.create({ name: roleName, color: 'Blue', mentionable: true });

            // 2. Create Channel
            const channelName = `match-${id}`;
            const channel = await guild.channels.create({
                name: channelName,
                type: 0,
                permissionOverwrites: [
                    { id: guild.roles.everyone, deny: ['ViewChannel'] },
                    { id: role.id, allow: ['ViewChannel', 'SendMessages'] },
                    { id: user.id, allow: ['ViewChannel', 'SendMessages', 'ManageChannels'] }
                ]
            });

            // 3. Save to DB
            db.matches[id] = {
                channelId: channel.id,
                roleId: role.id,
                hostId: user.id,
                players: [{ userId: user.id, country: 'TBD' }],
                mode: 'Unset',
                speed: 'Unset',
                isOpen: interaction.options.getBoolean('open-search') || false
            };
            saveDB();

            await interaction.reply({ 
                content: `⚔️ **Match Created!**\nID: **${id}**\nChannel: ${channel}\nRole: ${role}\nHost: ${user}`, 
                ephemeral: true 
            });
        }

        // --- SET TYPE ---
        else if (sub === 'set-type') {
            if (!db.matches[gameId]) return interaction.reply({ content: '❌ Match ID not found.', ephemeral: true });
            if (!isHost(gameId)) return interaction.reply({ content: '❌ Only the host can do this.', ephemeral: true });
            
            db.matches[gameId].mode = interaction.options.getString('mode');
            db.matches[gameId].speed = interaction.options.getString('speed');
            saveDB();
            await interaction.reply({ content: `⚙️ Match **${gameId}** updated: ${db.matches[gameId].mode} @ ${db.matches[gameId].speed}`, ephemeral: true });
        }

        // --- SET COUNTRY ---
        else if (sub === 'set-country') {
            if (!db.matches[gameId]) return interaction.reply({ content: '❌ Match ID not found.', ephemeral: true });
            const country = interaction.options.getString('country');
            const match = db.matches[gameId];
            
            let player = match.players.find(p => p.userId === user.id);
            if (!player) {
                player = { userId: user.id, country: country };
                match.players.push(player);
            } else {
                player.country = country;
            }
            saveDB();
            await interaction.reply({ content: `🌍 In match **${gameId}**, you are **${country}**`, ephemeral: true });
        }

        // --- COUNTRY LIST ---
        else if (sub === 'country-list') {
            if (!db.matches[gameId]) return interaction.reply({ content: '❌ Match ID not found.', ephemeral: true });
            const m = db.matches[gameId];
            const list = m.players.map(p => `- <@${p.userId}>: ${p.country}`).join('\n') || 'None';
            
            const embed = new EmbedBuilder()
                .setTitle(`📋 Match ${gameId}`)
                .addFields(
                    { name: 'Host', value: `<@${m.hostId}>`, inline: true },
                    { name: 'Mode', value: m.mode, inline: true },
                    { name: 'Speed', value: m.speed, inline: true },
                    { name: 'Players', value: list, inline: false }
                )
                .setColor('#0099ff');
            await interaction.reply({ embeds: [embed] });
        }

        // --- ADD / REMOVE / TRANSFER / SEARCH ---
        else if (sub === 'add') {
            if (!db.matches[gameId] || !isHost(gameId)) return interaction.reply({ content: '❌ Invalid ID or not host.', ephemeral: true });
            const target = interaction.options.getUser('player');
            if (!db.matches[gameId].players.find(p => p.userId === target.id)) {
                db.matches[gameId].players.push({ userId: target.id, country: 'TBD' });
                saveDB();
                await interaction.reply({ content: `➕ Added ${target.tag}`, ephemeral: true });
            }
        }
        else if (sub === 'remove') {
            if (!db.matches[gameId] || !isHost(gameId)) return interaction.reply({ content: '❌ Invalid ID or not host.', ephemeral: true });
            const target = interaction.options.getUser('player');
            db.matches[gameId].players = db.matches[gameId].players.filter(p => p.userId !== target.id);
            saveDB();
            await interaction.reply({ content: `➖ Removed ${target.tag}`, ephemeral: true });
        }
        else if (sub === 'transfer-host') {
            if (!db.matches[gameId] || !isHost(gameId)) return interaction.reply({ content: '❌ Invalid ID or not host.', ephemeral: true });
            const newHost = interaction.options.getUser('new-host');
            db.matches[gameId].hostId = newHost.id;
            saveDB();
            await interaction.reply({ content: `👑 Host transferred to ${newHost.tag}`, ephemeral: true });
        }
        else if (sub === 'open-search' || sub === 'close-search') {
            if (!db.matches[gameId] || !isHost(gameId)) return interaction.reply({ content: '❌ Invalid ID or not host.', ephemeral: true });
            db.matches[gameId].isOpen = (sub === 'open-search');
            saveDB();
            await interaction.reply({ content: `📢 Search ${sub === 'open-search' ? 'Opened' : 'Closed'}`, ephemeral: true });
        }

        // --- LEAVE ---
        else if (sub === 'leave') {
            if (!db.matches[gameId]) return interaction.reply({ content: '❌ Match not found.', ephemeral: true });
            db.matches[gameId].players = db.matches[gameId].players.filter(p => p.userId !== user.id);
            if (db.matches[gameId].hostId === user.id && db.matches[gameId].players.length > 0) {
                db.matches[gameId].hostId = db.matches[gameId].players[0].userId;
            }
            saveDB();
            await interaction.reply({ content: '🚪 You left the match.', ephemeral: true });
        }

        // --- CLOSE & SAVE STATS ---
        else if (sub === 'close') {
            if (!db.matches[gameId] || !isHost(gameId)) return interaction.reply({ content: '❌ Invalid ID or not host.', ephemeral: true });
            const result = interaction.options.getString('result');
            
            // Update Stats for all players
            db.matches[gameId].players.forEach(p => {
                if (!db.players[p.userId]) db.players[p.userId] = { wins: 0, losses: 0, draws: 0 };
                if (result === 'win') db.players[p.userId].wins++;
                else if (result === 'loss') db.players[p.userId].losses++;
                else if (result === 'draw') db.players[p.userId].draws++;
            });
            
            // Cleanup
            const channelId = db.matches[gameId].channelId;
            const roleId = db.matches[gameId].roleId;
            delete db.matches[gameId];
            saveDB();

            // Delete Channel/Role (Optional - currently just locks channel)
            const channel = guild.channels.cache.get(channelId);
            if (channel) await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
            
            await interaction.reply({ content: `🏁 Match **${gameId}** closed. Result: **${result}**. Stats saved.`, ephemeral: true });
        }

        // --- REAL STATS ---
        else if (sub === 'stats') {
            const target = interaction.options.getUser('player');
            const stats = db.players[target.id] || { wins: 0, losses: 0, draws: 0 };
            const total = stats.wins + stats.losses + stats.draws;
            const rate = total === 0 ? '0.0' : ((stats.wins / total) * 100).toFixed(1);

            const embed = new EmbedBuilder()
                .setTitle(`📊 Stats: ${target.username}`)
                .addFields(
                    { name: 'Wins', value: `${stats.wins}`, inline: true },
                    { name: 'Losses', value: `${stats.losses}`, inline: true },
                    { name: 'Draws', value: `${stats.draws}`, inline: true },
                    { name: 'Win Rate', value: `${rate}%`, inline: true }
                )
                .setColor(total === 0 ? '#808080' : '#00ff00');
            await interaction.reply({ embeds: [embed] });
        }

    } catch (error) {
        console.error(error);
        await interaction.reply({ content: '❌ Error: ' + error.message, ephemeral: true });
    }
});

client.login(process.env.DISCORD_TOKEN);   