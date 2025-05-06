import { GameDig } from "gamedig";
import { Client, GatewayIntentBits } from "discord.js";

const {
  SERVER_IP,
  SERVER_PORT,
  DISCORD_TOKEN,
  GUILD_ID,
  CHANNEL_ID,
  INTERVAL_MINUTES = "5",
} = process.env;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function fetchServerState() {
  try {
    return await GameDig.query({
      type: "csgo",
      host: SERVER_IP,
      port: parseInt(SERVER_PORT, 10),
    });
  } catch (err) {
    console.error("Error querying server:", err);
    throw err;
  }
}

async function updateChannelName() {
  try {
    const state = await fetchServerState();
    const serverName = state.name;
    const activePlayers = state.players.length;
    const totalPlayers = state.maxplayers;

    const guild = await client.guilds.fetch(GUILD_ID);
    const channel = await guild.channels.fetch(CHANNEL_ID);
    const newName = `${serverName}: ${activePlayers} / ${totalPlayers}`;

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
  setInterval(updateChannelName, parseInt(INTERVAL_MINUTES, 10) * 60000);
});

client.login(DISCORD_TOKEN).catch((err) => {
  console.error("Discord login failed:", err);
  process.exit(1);
});
