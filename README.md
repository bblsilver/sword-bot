# ⚔️ Sword - Discord Bot

> [!WARNING]
> Please note that **Sword Bot** is still a work in progress.

**Sword** is a utility bot tailored to Conflict of Nations. It automates match setup, tracks player countries, manages permissions via dynamic roles, and records persistent win/loss statistics.

## Features 

- **Match Creation**: Create a match and automatically tailor custom channels & roles for the match.
- **Country Management**: Players can register their chosen country; hosts can view a full country list.
- **Player Management**: Hosts can add/remove players and transfer ownership.
- **Player Stats**: Tracks all player statistics including wins, losses, and draws in a local database (`database.json`). Win rates are calculated automatically.

## Commands

| Command | Description | Permissions |
| :--- | :--- | :--- |
| `/match create` | Creates a new match channel, role, and initializes the Game ID. | Everyone |
| `/match set-id` | Sets the in-game Match ID (if not set during creation). | Host |
| `/match set-type` | Sets the game mode (e.g., Ranked) and speed (e.g., 2x). | Host |
| `/match set-country` | Registers your country for the specific Match ID. | Players |
| `/match country-list` | Displays all players, their countries, and match settings. | Everyone |
| `/match add` | Adds a user to the match. | Host |
| `/match remove` | Removes a user from the match. | Host |
| `/match transfer-host` | Transfers host ownership to another player. | Host |
| `/match leave` | Removes yourself from the match. | Players |
| `/match close` | Ends the match, archives the channel, and saves stats. | Host |
| `/match stats` | View a player's total wins, losses, and win rate. | Everyone |
