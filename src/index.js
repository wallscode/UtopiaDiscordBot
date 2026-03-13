require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const { parseMessage } = require('./handlers/dragonParser');
const { load, record } = require('./handlers/dragonStore');
const { backfill } = require('./handlers/backfill');
const dragonCommand = require('./commands/dragon');

load();

async function registerCommands() {
  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: [dragonCommand.data.toJSON()] }
  );
  console.log('Slash commands registered.');
}

const WATCHED_CHANNELS = ['dragons'];
const SOURCE_BOT_USERNAME = 'utopiabot';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  await backfill(guild, 'dragons');
});

client.on('messageCreate', (message) => {
  if (message.author.username !== SOURCE_BOT_USERNAME) return;
  if (!WATCHED_CHANNELS.includes(message.channel.name)) return;

  const parsed = parseMessage(message.content);
  if (!parsed) return;

  record(parsed, message.id);
  console.log(`Recorded [${parsed.type}] for province: ${parsed.province}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try {
    if (interaction.commandName === 'dragon-stats') {
      await dragonCommand.execute(interaction);
    }
  } catch (error) {
    console.error('Command error:', error);
    const msg = { content: 'An error occurred running that command.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg);
    } else {
      await interaction.reply(msg);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
