# Gamedig-Channel-Name-Script

This script uses [GameDig](https://www.npmjs.com/package/gamedig) and the Discord API to dynamically update voice channel names in a Discord server with the current player count from game servers (e.g., CSGO).

## Features

- Queries multiple game servers periodically.
- Updates corresponding Discord voice channel names to reflect current players (e.g., `AUTOMIX #1: 5/10`).
- Fully automated with GitHub Actions (runs every 2 minutes).

## Usage

1. Clone the repo.
2. Set the following environment secrets in your GitHub repo:
   - `DISCORD_TOKEN`
   - `GUILD_ID`
3. Configure your game servers and Discord channel IDs in `updateChannel.js`.
4. Push to GitHub — GitHub Actions will handle the rest via `update-voice-channel.yml`.

## Workflow

- Triggered on schedule (every 2 minutes) or manually via `workflow_dispatch`.
- Runs on Node.js 18 using GitHub-hosted runners.

## Dependencies

- `discord.js`
- `gamedig`

---

Made for quick server status visibility directly in Discord.
