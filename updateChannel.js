import * as Gamedig from "gamedig";
import { Client, Intents } from "discord.js";

const {
  SERVER_IP,
  SERVER_PORT,
  DISCORD_TOKEN,
  GUILD_ID,
  CHANNEL_ID,
  INTERVAL_MINUTES = "5",
} = process.env;

const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

async function fetchPlayerCount() {
  try {
    const state = await Gamedig.query({
      type: "csgo",
      host: SERVER_IP,
      port: parseInt(SERVER_PORT, 10),
    });
    return state.players.length;
  } catch (err) {
    console.error("Error querying server:", err);
    throw err;
  }
}

async function updateChannelName() {
  try {
    const count = await fetchPlayerCount();
    const channel = await client.guilds.cache
      .get(GUILD_ID)
      .channels.fetch(CHANNEL_ID);
    const newName = `5v5 Mix: ${count} Players`;
    if (channel.name !== newName) {
      await channel.setName(newName);
      console.log(`Renamed channel to "${newName}"`);
    } else {
      console.log("No change needed");
    }
  } catch (err) {
    console.error("Error updating channel:", err);
  }
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  updateChannelName();
  setInterval(updateChannelName, parseInt(INTERVAL_MINUTES, 10) * 60 * 1000);
});

client.login(DISCORD_TOKEN).catch((err) => {
  console.error("Discord login failed:", err);
  process.exit(1);
});
