const { update } = require('./activityStore');
const { parseMessage } = require('./activityParser');

const SOURCE_BOT_USERNAME = 'utopiabot';
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const DISCORD_EPOCH = 1420070400000n;

const SCAN_CHANNELS = ['dragons', 'aid', 'attackers', 'ritual', 'tms', 'general'];

function timestampToSnowflake(ms) {
  return String((BigInt(ms) - DISCORD_EPOCH) << 22n);
}

async function backfillChannel(channel, afterId) {
  let lastFetchedId = afterId;
  let processed = 0;

  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, after: lastFetchedId });
    if (batch.size === 0) break;

    const sorted = [...batch.values()].sort(
      (a, b) => Number(BigInt(a.id) - BigInt(b.id))
    );

    for (const msg of sorted) {
      if (msg.author.username !== SOURCE_BOT_USERNAME) continue;
      const events = parseMessage(msg.content, channel.name);
      for (const { province, action } of events) {
        update(province, msg.createdAt.toISOString(), action);
        processed++;
      }
    }

    lastFetchedId = sorted[sorted.length - 1].id;
    if (batch.size < 100) break;
  }

  return processed;
}

async function backfillActivity(guild) {
  const afterId = timestampToSnowflake(Date.now() - TWO_WEEKS_MS);
  console.log('Backfilling activity from all channels...');

  for (const channelName of SCAN_CHANNELS) {
    const channel = guild.channels.cache.find(
      (c) => c.name === channelName && c.isTextBased()
    );
    if (!channel) {
      console.log(`  #${channelName}: not found, skipping.`);
      continue;
    }
    const count = await backfillChannel(channel, afterId);
    console.log(`  #${channelName}: ${count} activity events recorded.`);
  }

  console.log('Activity backfill complete.');
}

module.exports = { backfillActivity };
