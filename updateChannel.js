import { GameDig } from "gamedig";
import { Client, GatewayIntentBits } from "discord.js";

const { DISCORD_TOKEN, GUILD_ID, INTERVAL_MINUTES = "1" } = process.env;
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

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
      const players = state ? state.players.length : "?";
      const max = state ? state.maxplayers : "?";
      const newName = `${server.name}: ${players}/${max}`;
      const channel = await guild.channels.fetch(server.channelId);
      if (channel.name !== newName) {
        await channel.setName(newName);
        console.log(`Renamed ${server.name} to "${newName}"`);
      }
    })
  );
}

client.once("ready", () => {
  updateChannels();
  setInterval(updateChannels, parseInt(INTERVAL_MINUTES, 10) * 60000);
});

client.login(DISCORD_TOKEN);
