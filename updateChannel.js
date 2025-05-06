import { GameDig } from "gamedig";
import { Client, GatewayIntentBits } from "discord.js";

const {
  DISCORD_TOKEN,
  GUILD_ID,
  CHANNEL_ID,
  INTERVAL_MINUTES = "5",
} = process.env;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const servers = [
  { name: "AUTOMIX #1", host: "193.31.28.17", port: 27015 },
  { name: "AUTOMIX #2", host: "193.31.28.17", port: 27035 },
  { name: "DEATHMATCH", host: "193.31.28.17", port: 27025 },
];

async function fetchState(server) {
  try {
    return await GameDig.query({
      type: "csgo",
      host: server.host,
      port: server.port,
    });
  } catch (err) {
    console.error(`Error querying ${server.name}:`, err);
    return null;
  }
}

async function updateChannelName() {
  try {
    const results = await Promise.all(servers.map(fetchState));
    const nameParts = results.map((state, i) =>
      state
        ? `${servers[i].name} ${state.players.length}`
        : `${servers[i].name} ?`
    );
    const newName =
      nameParts.length > 1
        ? `${nameParts.slice(0, -1).join(", ")} and ${nameParts.slice(-1)}`
        : nameParts[0];
    const guild = await client.guilds.fetch(GUILD_ID);
    const channel = await guild.channels.fetch(CHANNEL_ID);
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
