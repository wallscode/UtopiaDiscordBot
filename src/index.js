require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { parseMessage } = require('./handlers/dragonParser');
const { record } = require('./handlers/dragonStore');

const WATCHED_CHANNELS = ['dragons'];
const SOURCE_BOT_USERNAME = 'utopiabot';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', (message) => {
  if (message.author.username !== SOURCE_BOT_USERNAME) return;
  if (!WATCHED_CHANNELS.includes(message.channel.name)) return;

  const parsed = parseMessage(message.content);
  if (!parsed) return;

  record(parsed);
  console.log(`Recorded [${parsed.type}] for province: ${parsed.province}`);
});

client.login(process.env.DISCORD_TOKEN);
