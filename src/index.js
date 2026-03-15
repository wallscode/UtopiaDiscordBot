require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const { parseMessage } = require('./handlers/dragonParser');
const { load: loadDragon, record } = require('./handlers/dragonStore');
const { load: loadProvinces } = require('./handlers/provinceStore');
const { load: loadActivity, update: updateActivity } = require('./handlers/activityStore');
const { backfill } = require('./handlers/backfill');
const { backfillActivity } = require('./handlers/activityBackfill');
const { parseMessage: parseActivityMessage } = require('./handlers/activityParser');
const dragonCommand = require('./commands/dragon');
const provincesCommand = require('./commands/provinces');
const activityCommand = require('./commands/activity');

loadDragon();
loadProvinces();
loadActivity();

const COMMANDS = [dragonCommand, provincesCommand, activityCommand];

async function registerCommands() {
  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: COMMANDS.map((c) => c.data.toJSON()) }
  );
  console.log('Slash commands registered.');
}

const DRAGON_CHANNEL = 'dragons';
const ACTIVITY_CHANNELS = ['dragons', 'aid', 'attackers', 'ritual', 'tms', 'general'];
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
  await backfillActivity(guild);
});

client.on('messageCreate', (message) => {
  if (message.author.username !== SOURCE_BOT_USERNAME) return;

  const channelName = message.channel.name;

  // Dragon parsing (donations + attacks)
  if (channelName === DRAGON_CHANNEL) {
    const parsed = parseMessage(message.content);
    if (parsed) {
      record(parsed, message.id);
      console.log(`Recorded [${parsed.type}] for province: ${parsed.province}`);
    }
  }

  // Activity tracking across all channels
  if (ACTIVITY_CHANNELS.includes(channelName)) {
    const events = parseActivityMessage(message.content, channelName);
    for (const { province, action } of events) {
      updateActivity(province, message.createdAt.toISOString(), action);
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = COMMANDS.find((c) => c.data.name === interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
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
