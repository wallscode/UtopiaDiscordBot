require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const { parseMessage } = require('./handlers/dragonParser');
const { load: loadDragon, record } = require('./handlers/dragonStore');
const { load: loadProvinces } = require('./handlers/provinceStore');
const { load: loadActivity, update: updateActivity } = require('./handlers/activityStore');
const { backfill } = require('./handlers/backfill');
const { backfillActivity } = require('./handlers/activityBackfill');
const { backfillEvents } = require('./handlers/eventBackfill');
const { parseMessage: parseActivityMessage } = require('./handlers/activityParser');
const { addAid, addAttack, addRitual, addEspionage } = require('./handlers/eventStore');
const { parseAidMessage } = require('./parsers/aidParser');
const { parseAttackMessage } = require('./parsers/attackParser');
const { parseRitualMessage } = require('./parsers/ritualParser');
const { parseEspionageMessage } = require('./parsers/espionageParser');
const dragonCommand = require('./commands/dragon');
const provincesCommand = require('./commands/provinces');
const activityCommand = require('./commands/activity');
const attackStatsCommand = require('./commands/attackStats');
const aidSummaryCommand = require('./commands/aidSummary');
const espionageStatsCommand = require('./commands/espionageStats');
const ritualStatsCommand = require('./commands/ritualStats');
const provinceReportCommand = require('./commands/provinceReport');
const kingdomReportCommand = require('./commands/kingdomReport');
const timeConvertCommand = require('./commands/timeConvert');

loadDragon();
loadProvinces();
loadActivity();

const COMMANDS = [
  dragonCommand,
  provincesCommand,
  activityCommand,
  attackStatsCommand,
  aidSummaryCommand,
  espionageStatsCommand,
  ritualStatsCommand,
  provinceReportCommand,
  kingdomReportCommand,
  timeConvertCommand,
];

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

const EVENT_CHANNELS = {
  aid:       { parse: parseAidMessage,       add: addAid },
  attackers: { parse: parseAttackMessage,    add: addAttack },
  ritual:    { parse: parseRitualMessage,    add: addRitual },
  tms:       { parse: parseEspionageMessage, add: addEspionage },
};

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
  await backfillEvents(guild);
});

client.on('messageCreate', (message) => {
  if (message.author.username !== SOURCE_BOT_USERNAME) return;

  const channelName = message.channel.name;

  // Dragon parsing (donations + attacks)
  if (channelName === DRAGON_CHANNEL) {
    const parsed = parseMessage(message.content);
    if (parsed) {
      record(parsed, message.id, message.createdAt.toISOString());
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

  // Live event store updates for aid/attackers/ritual/tms
  const eventConfig = EVENT_CHANNELS[channelName];
  if (eventConfig) {
    const timestamp = message.createdAt.toISOString();
    const events = eventConfig.parse(message.content, timestamp);
    for (const event of events) {
      eventConfig.add(event);
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
