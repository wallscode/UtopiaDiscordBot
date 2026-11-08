const { addAid } = require('./eventStore');
const { addAttack } = require('./eventStore');
const { addRitual } = require('./eventStore');
const { addEspionage } = require('./eventStore');
const { parseAidMessage } = require('../parsers/aidParser');
const { parseAttackMessage } = require('../parsers/attackParser');
const { parseRitualMessage } = require('../parsers/ritualParser');
const { parseEspionageMessage } = require('../parsers/espionageParser');
const { parseSelfSpellMessage } = require('../parsers/selfSpellParser');
const { parseDragonLines } = require('./dragonParser');
const { logMessageEvents, WAR_LOG_RETENTION_DAYS, LOGGED_CHANNELS } = require('../war/context');

const SOURCE_BOT_USERNAME = 'utopiabot';
const DAY_MS = 24 * 60 * 60 * 1000;
// The in-memory store behind /tm-stats, /attack-stats etc. covers two weeks.
const STORE_WINDOW_MS = 14 * DAY_MS;
// The on-disk war log reaches further back, so a war that ended a couple of
// weeks ago can still be filled in. Matches the log's retention (context.js).
const WAR_LOG_WINDOW_MS = WAR_LOG_RETENTION_DAYS * DAY_MS;
const DISCORD_EPOCH = 1420070400000n;

const CHANNEL_CONFIG = {
  aid:       { parse: parseAidMessage,       add: addAid },
  attacks:   { parse: parseAttackMessage,    add: addAttack },
  ritual:    { parse: parseRitualMessage,    add: addRitual },
  'tm-ops':  { parse: parseEspionageMessage, add: addEspionage },
  // Self-spells only go to the on-disk war log; no command reads them live.
  'self-spells': { parse: parseSelfSpellMessage, add: null },
  // Dragons go to the war log here; /dragon-stats keeps its own store,
  // filled by handlers/backfill.js.
  dragons: { parse: parseDragonLines, add: null },
};

function timestampToSnowflake(ms) {
  return String((BigInt(ms) - DISCORD_EPOCH) << 22n);
}

async function backfillChannel(channel) {
  const config = CHANNEL_CONFIG[channel.name];
  if (!config) return { count: 0, logged: 0 };

  const now = Date.now();
  const storeCutoff = now - STORE_WINDOW_MS;
  const window = LOGGED_CHANNELS[channel.name]
    ? Math.max(STORE_WINDOW_MS, WAR_LOG_WINDOW_MS)
    : STORE_WINDOW_MS;
  const afterId = timestampToSnowflake(now - window);
  let lastFetchedId = afterId;
  let count = 0;
  let logged = 0;

  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, after: lastFetchedId });
    if (batch.size === 0) break;

    const sorted = [...batch.values()].sort(
      (a, b) => Number(BigInt(a.id) - BigInt(b.id))
    );

    for (const msg of sorted) {
      if (msg.author.username !== SOURCE_BOT_USERNAME) continue;
      const events = config.parse(msg.content, msg.createdAt.toISOString());
      if (config.add && msg.createdTimestamp >= storeCutoff) {
        for (const event of events) {
          config.add(event);
          count++;
        }
      }
      logged += logMessageEvents(channel.name, msg.id, events);
    }

    lastFetchedId = sorted[sorted.length - 1].id;
    if (batch.size < 100) break;
  }

  return { count, logged };
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
    const { count, logged } = await backfillChannel(channel);
    console.log(`  #${channelName}: ${count} events loaded (${logged} new in the war log).`);
  }
  console.log('Event backfill complete.');
}

module.exports = { backfillEvents };
