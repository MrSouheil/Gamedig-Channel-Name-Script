# Gamedig-Channel-Name-Script

This script uses [GameDig](https://www.npmjs.com/package/gamedig) and the Discord API to dynamically update voice channel names in a Discord server with the current player count from game servers (e.g., CSGO).

## Features

- Queries multiple game servers periodically.
- Updates corresponding Discord voice channel names to reflect current players (e.g., `AUTOMIX #1: 5/10`).
- Fully automated with GitHub Actions (runs every 2 minutes).

- Posts an editable Automix leaderboard message to a Discord channel and keeps it updated on a schedule. The bot will edit the same message each run (message id persisted to `leaderboard_message_id.json`).

## Usage

1. Clone the repo.
2. Set the following environment secrets in your GitHub repo:
   - `DISCORD_TOKEN`
   - `GUILD_ID`
   - (Optional) `LEADERBOARD_INTERVAL_MINUTES` — interval in minutes for the leaderboard update (default 30)
   - (Optional) `INTERVAL_MINUTES` — interval in minutes for server channel name updates (default 5)
3. Configure your game servers and Discord channel IDs in `updateChannel.js`.
4. Push to GitHub — GitHub Actions will handle the rest via `update-voice-channel.yml`.

Notes about the leaderboard feature and GitHub Actions

- The script saves the leaderboard message id to `leaderboard_message_id.json` so subsequent runs edit the same Discord message instead of creating a new one.
- If you want the workflow to persist that file back to the repo (so multiple workflow runs share the id), ensure your workflow:

      - checks out the repo with `persist-credentials: true` and `fetch-depth: 0` (actions/checkout@v3)
      - grants `contents: write` permission to allow pushing with `GITHUB_TOKEN`
      - exposes `GITHUB_TOKEN` to the run step if you want the script to use it directly (the workflow can pass it as an env var)

- Alternatively, you can let the script fall back to searching recent messages in the channel for a previous leaderboard message (it does this automatically) and skip committing the file.

## Workflow

- Triggered on schedule (every 2 minutes) or manually via `workflow_dispatch`.
- Runs on Node.js 18 using GitHub-hosted runners.

## Dependencies

- `discord.js`
- `gamedig`

---

Made for quick server status visibility directly in Discord.
