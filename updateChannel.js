import { GameDig } from "gamedig";
import {
  Client,
  GatewayIntentBits,
  AttachmentBuilder,
  EmbedBuilder,
} from "discord.js";
import fs from "fs";
import { exec } from "child_process";
import { renderLeaderboardImage } from "./leaderboardImage.js";

const {
  DISCORD_TOKEN,
  GUILD_ID,
  INTERVAL_MINUTES = "5",
  LEADERBOARD_INTERVAL_MINUTES = "30",
  RUN_ONCE = "false",
} = process.env;

const runOnce = RUN_ONCE === "true";
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const LEADERBOARD_URL = "https://automix.me/files/leaderboard.json";
const LEADERBOARD_CHANNEL_ID = "1430989874269519993";

const servers = [
  {
    name: "AUTOMIX #1",
    host: "212.87.212.202",
    port: 27015,
    channelId: "1369430010297057463",
  },
  {
    name: "AUTOMIX #2",
    host: "212.87.212.202",
    port: 27035,
    channelId: "1369430033525112954",
  },
  {
    name: "AUTOMIX #3",
    host: "212.87.212.202",
    port: 27045,
    channelId: "1427802825823359026",
  },
  {
    name: "DEATHMATCH",
    host: "212.87.212.202",
    port: 27025,
    channelId: "1369430067285065738",
  },
];

async function fetchState({ host, port }) {
  try {
    return await GameDig.query({ type: "csgo", host, port });
  } catch (err) {
    console.error(`[WARN] fetchState failed ${host}:${port}`, err);
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
          (p) => (p.name || "").toLowerCase() === "maxfps tv"
        );
        players = state.players.length - (isSourceTVPresent ? 1 : 0);
        max = state.maxplayers;
      } else {
        console.log(`[WARN] No state received for ${server.name}`);
      }

      const newName = `${server.name}: ${players}/${max}`;
      const channel = await guild.channels.fetch(server.channelId);
      if (channel && channel.name !== newName) {
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
    // fetch remote and rebase to avoid non-fast-forward errors
    `git fetch origin`,
    `git rebase origin/$(git rev-parse --abbrev-ref HEAD) || true`,
    // push; if rebase didn't work, attempt force push as a last resort
    `git push origin HEAD:refs/heads/$(git rev-parse --abbrev-ref HEAD) || git push --force origin HEAD:refs/heads/$(git rev-parse --abbrev-ref HEAD)`,
  ].join(" && ");

  return new Promise((resolve) => {
    exec(cmds, { cwd: process.cwd(), env: process.env }, (err) => {
      if (err) {
        console.log(`[WARN] Could not commit message id: ${err.message}`);
        return resolve(false);
      }
      console.log("Persisted leaderboard message id to repository");
      return resolve(true);
    });
  });
}

let leaderboardMessageId = loadMessageIdFromFile();

function buildEmbed({ last_update }) {
  return new EmbedBuilder().setColor(0xff0000).setTitle("🏆 Automix Rank");
}

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

  try {
    const png = renderLeaderboardImage({
      title: "Top Players",
      rows: (data.rank || []).slice(0, 10),
      lastUpdate: data.last_update,
    });

    const fileName = "leaderboard.png";
    const attachment = new AttachmentBuilder(png, { name: fileName });
    const embed = buildEmbed({ last_update: data.last_update }).setImage(
      `attachment://${fileName}`
    );

    let message = null;

    if (leaderboardMessageId) {
      message = await channel.messages
        .fetch(leaderboardMessageId)
        .catch(() => null);
    }

    if (!message) {
      const recent = await channel.messages.fetch({ limit: 100 });
      // Find either an existing embed image message or a legacy text leaderboard
      message = recent.find((m) => {
        if (m.author?.id !== client.user.id) return false;
        if (m.embeds?.[0]?.title?.includes("Automix Leaderboard")) return true;
        if (m.content && m.content.startsWith("Automix Leaderboard"))
          return true;
        return false;
      });
    }

    if (message) {
      // If the message was a legacy text message, replace it with the embed+image
      await message.edit({
        content: null,
        embeds: [embed],
        files: [attachment],
      });
      leaderboardMessageId = message.id;
      saveMessageIdToFile(leaderboardMessageId);
      await commitMessageIdIfPossible();
      console.log("Updated leaderboard image message");
    } else {
      const sent = await channel.send({ embeds: [embed], files: [attachment] });
      leaderboardMessageId = sent.id;
      saveMessageIdToFile(leaderboardMessageId);
      await commitMessageIdIfPossible();
      console.log("Sent new leaderboard image message");
    }
  } catch (err) {
    console.log(
      `[ERROR] Could not send/edit leaderboard image message: ${err.message}`
    );
  }
}

client.once("ready", async () => {
  try {
    await updateChannels();
    await updateLeaderboardMessage();
  } finally {
    if (runOnce) {
      setTimeout(() => process.exit(0), 1500);
      return;
    }
    setInterval(updateChannels, parseInt(INTERVAL_MINUTES, 10) * 60000);
    setInterval(
      updateLeaderboardMessage,
      parseInt(LEADERBOARD_INTERVAL_MINUTES, 10) * 60000
    );
  }
});

client.login(DISCORD_TOKEN);
