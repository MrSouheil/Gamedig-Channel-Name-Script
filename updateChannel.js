import { GameDig } from "gamedig";
import { Client, GatewayIntentBits } from "discord.js";
import fs from "fs";
import { exec } from "child_process";

const { DISCORD_TOKEN, GUILD_ID, INTERVAL_MINUTES = "5" } = process.env;
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Leaderboard configuration
const LEADERBOARD_URL = "https://automix.me/files/leaderboard.json";
const LEADERBOARD_CHANNEL_ID = "1430989874269519993"; // Manually inserted
const LEADERBOARD_INTERVAL_MINUTES = parseInt(
  process.env.LEADERBOARD_INTERVAL_MINUTES ?? "30",
  10
);

const servers = [
  {
    name: "AUTOMIX #1",
    host: "193.31.28.17",
    port: 27015,
    channelId: "1369430010297057463",
  },
  {
    name: "AUTOMIX #2",
    host: "193.31.28.17",
    port: 27035,
    channelId: "1369430033525112954",
  },
  {
    name: "AUTOMIX #3",
    host: "193.31.28.17",
    port: 27045,
    channelId: "1427802825823359026",
  },
  {
    name: "DEATHMATCH",
    host: "193.31.28.17",
    port: 27025,
    channelId: "1369430067285065738",
  },
];

async function fetchState({ host, port }) {
  try {
    return await GameDig.query({ type: "csgo", host, port });
  } catch {
    return null;
  }
}

async function updateChannels() {
  const guild = await client.guilds.fetch(GUILD_ID);
  await Promise.all(
    servers.map(async (server) => {
      const state = await fetchState(server);
      let players = "?";
      let max = "?";

      if (state) {
        const isSourceTVPresent = state.players.some(
          (p) => p.name.toLowerCase() === "maxfps tv"
        );
        players = state.players.length - (isSourceTVPresent ? 1 : 0);
        max = state.maxplayers;

        if (players === 0 || max === 0) {
          console.log(
            `[WARN] Possible anomaly for ${server.name}: players=${players}, max=${max}, state=`,
            JSON.stringify(state, null, 2)
          );
        }
      } else {
        console.log(`[WARN] No state received for ${server.name}`);
      }

      const newName = `${server.name}: ${players}/${max}`;
      const channel = await guild.channels.fetch(server.channelId);
      if (channel.name !== newName) {
        await channel.setName(newName);
        console.log(`Renamed ${server.name} to "${newName}"`);
      }
    })
  );
}

async function fetchLeaderboard() {
  try {
    const res = await fetch(LEADERBOARD_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json;
  } catch (err) {
    console.log(`[WARN] Failed to fetch leaderboard: ${err.message}`);
    return null;
  }
}

function pad(str, width, align = "right") {
  str = String(str ?? "");
  if (str.length >= width) return str.slice(0, width);
  const padLen = width - str.length;
  return align === "right"
    ? " ".repeat(padLen) + str
    : str + " ".repeat(padLen);
}

function formatLeaderboard(rank = [], lastUpdate) {
  // columns: #, name, pts, k, d, kdr
  const header = `${pad("#", 3, "right")} ${pad("Name", 16, "left")} ${pad(
    "Pts",
    7,
    "right"
  )} ${pad("K", 5, "right")} ${pad("D", 5, "right")} ${pad(
    "KDR",
    6,
    "right"
  )} `;
  const lines = [header, "-".repeat(header.length)];
  const top = rank.slice(0, 15);
  top.forEach((p, i) => {
    const line = `${pad(i + 1, 3)} ${pad(p.name, 16, "left")} ${pad(
      p.points,
      7
    )} ${pad(p.kills, 5)} ${pad(p.deaths, 5)} ${pad(p.kdr, 6)}`;
    lines.push(line);
  });

  const last = lastUpdate
    ? `Last update: ${lastUpdate}`
    : "Last update: unknown";
  return (
    `Automix Leaderboard\n\n` +
    "```" +
    "\n" +
    lines.join("\n") +
    "\n```" +
    `\n${last}`
  );
}

const MSG_ID_FILE = "leaderboard_message_id.json";

function loadMessageIdFromFile() {
  try {
    if (!fs.existsSync(MSG_ID_FILE)) return null;
    const raw = fs.readFileSync(MSG_ID_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return parsed?.id ?? null;
  } catch (err) {
    console.log(`[WARN] Could not load message id file: ${err.message}`);
    return null;
  }
}

function saveMessageIdToFile(id) {
  try {
    fs.writeFileSync(MSG_ID_FILE, JSON.stringify({ id }, null, 2), "utf8");
  } catch (err) {
    console.log(`[WARN] Could not save message id file: ${err.message}`);
  }
}

async function commitMessageIdIfPossible() {
  // Only attempt when running inside GitHub Actions and a token is provided
  const GITHUB_ACTIONS = process.env.GITHUB_ACTIONS;
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;

  if (!GITHUB_ACTIONS || !GITHUB_TOKEN || !GITHUB_REPOSITORY) return;

  const repoUrl = `https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git`;
  const cmds = [
    `git config user.email "actions@github.com"`,
    `git config user.name "github-actions[bot]"`,
    `git remote set-url origin ${repoUrl}`,
    `git add ${MSG_ID_FILE}`,
    `git commit -m "chore: persist leaderboard message id" || true`,
    `git push origin HEAD:refs/heads/$(git rev-parse --abbrev-ref HEAD)`,
  ].join(" && ");

  return new Promise((resolve) => {
    exec(
      cmds,
      { cwd: process.cwd(), env: process.env },
      (err, stdout, stderr) => {
        if (err) {
          console.log(`[WARN] Could not commit message id: ${err.message}`);
          return resolve(false);
        }
        console.log("Persisted leaderboard message id to repository");
        return resolve(true);
      }
    );
  });
}

let leaderboardMessageId = loadMessageIdFromFile(); // will be null if not present

async function updateLeaderboardMessage() {
  const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
  if (!guild) {
    console.log("[WARN] Leaderboard guild not available");
    return;
  }

  const channel = await guild.channels
    .fetch(LEADERBOARD_CHANNEL_ID)
    .catch(() => null);
  if (!channel || !channel.isTextBased()) {
    console.log("[WARN] Leaderboard channel not available or not text based");
    return;
  }

  const data = await fetchLeaderboard();
  if (!data) return;

  const content = formatLeaderboard(data.rank, data.last_update);

  try {
    let message = null;

    // Try to find previously-known message id
    if (leaderboardMessageId) {
      message = await channel.messages
        .fetch(leaderboardMessageId)
        .catch(() => null);
    }

    // Fallback: search recent bot messages that look like our leaderboard
    if (!message) {
      const recent = await channel.messages.fetch({ limit: 100 });
      message = recent.find(
        (m) =>
          m.author?.id === client.user.id &&
          m.content &&
          m.content.startsWith("Automix Leaderboard")
      );
    }

    if (message) {
      await message.edit({ content });
      leaderboardMessageId = message.id;
      saveMessageIdToFile(leaderboardMessageId);
      await commitMessageIdIfPossible();
      console.log("Updated leaderboard message");
    } else {
      const sent = await channel.send({ content });
      leaderboardMessageId = sent.id;
      saveMessageIdToFile(leaderboardMessageId);
      await commitMessageIdIfPossible();
      console.log("Sent new leaderboard message");
    }
  } catch (err) {
    console.log(
      `[ERROR] Could not send/edit leaderboard message: ${err.message}`
    );
  }
}

client.once("ready", () => {
  updateChannels();
  setInterval(updateChannels, parseInt(INTERVAL_MINUTES, 10) * 60000);

  // Start leaderboard updater immediately and schedule it
  updateLeaderboardMessage();
  setInterval(updateLeaderboardMessage, LEADERBOARD_INTERVAL_MINUTES * 60000);
});

client.login(DISCORD_TOKEN);
