const { addAid } = require('./eventStore');
const { addAttack } = require('./eventStore');
const { addRitual } = require('./eventStore');
const { addEspionage } = require('./eventStore');
const { parseAidMessage } = require('../parsers/aidParser');
const { parseAttackMessage } = require('../parsers/attackParser');
const { parseRitualMessage } = require('../parsers/ritualParser');
const { parseEspionageMessage } = require('../parsers/espionageParser');

const SOURCE_BOT_USERNAME = 'utopiabot';
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const DISCORD_EPOCH = 1420070400000n;

const CHANNEL_CONFIG = {
  aid:       { parse: parseAidMessage,       add: addAid },
  attackers: { parse: parseAttackMessage,    add: addAttack },
  ritual:    { parse: parseRitualMessage,    add: addRitual },
  tms:       { parse: parseEspionageMessage, add: addEspionage },
};

function timestampToSnowflake(ms) {
  return String((BigInt(ms) - DISCORD_EPOCH) << 22n);
}

async function backfillChannel(channel) {
  const config = CHANNEL_CONFIG[channel.name];
  if (!config) return 0;

  const afterId = timestampToSnowflake(Date.now() - TWO_WEEKS_MS);
  let lastFetchedId = afterId;
  let count = 0;

  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, after: lastFetchedId });
    if (batch.size === 0) break;

    const sorted = [...batch.values()].sort(
      (a, b) => Number(BigInt(a.id) - BigInt(b.id))
    );

    for (const msg of sorted) {
      if (msg.author.username !== SOURCE_BOT_USERNAME) continue;
      const events = config.parse(msg.content, msg.createdAt.toISOString());
      for (const event of events) {
        config.add(event);
        count++;
      }
    }

    lastFetchedId = sorted[sorted.length - 1].id;
    if (batch.size < 100) break;
  }

  return count;
}

async function backfillEvents(guild) {
  console.log('Backfilling event data from all channels...');
  for (const channelName of Object.keys(CHANNEL_CONFIG)) {
    const channel = guild.channels.cache.find(
      (c) => c.name === channelName && c.isTextBased()
    );
    if (!channel) {
      console.log(`  #${channelName}: not found, skipping.`);
      continue;
    }
    const count = await backfillChannel(channel);
    console.log(`  #${channelName}: ${count} events loaded.`);
  }
  console.log('Event backfill complete.');
}

module.exports = { backfillEvents };
