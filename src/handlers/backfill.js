const { parseMessage } = require('./dragonParser');
const { record, addEventOnly, getLastMessageId } = require('./dragonStore');

const DISCORD_EPOCH = 1420070400000n;
const TWO_WEEKS_MS = 14n * 24n * 60n * 60n * 1000n;
const SOURCE_BOT_USERNAME = 'utopiabot';

function timestampToSnowflake(ms) {
  return String((BigInt(ms) - DISCORD_EPOCH) << 22n);
}

async function backfill(guild, channelName) {
  const channel = guild.channels.cache.find(
    (c) => c.name === channelName && c.isTextBased()
  );
  if (!channel) {
    console.warn(`Backfill: channel #${channelName} not found.`);
    return;
  }

  // Always fetch at least two weeks back so recently-missed messages are retried.
  // Province totals (all-time) are only updated for messages newer than lastMessageId
  // to prevent double-counting. Events are rebuilt fresh every startup.
  const lastId = getLastMessageId();
  const twoWeeksAgoSnowflake = timestampToSnowflake(Date.now() - Number(TWO_WEEKS_MS));

  console.log(`Backfilling #${channelName} from two weeks ago (events) / last seen message (provinces)...`);

  let processed = 0;
  let lastFetchedId = twoWeeksAgoSnowflake;

  while (true) {
    const messages = await channel.messages.fetch({ limit: 100, after: lastFetchedId });
    if (messages.size === 0) break;

    // Process in chronological order (oldest first)
    const sorted = [...messages.values()].sort(
      (a, b) => Number(BigInt(a.id) - BigInt(b.id))
    );

    for (const msg of sorted) {
      if (msg.author.username !== SOURCE_BOT_USERNAME) continue;
      const parsed = parseMessage(msg.content);
      if (!parsed) continue;

      const timestamp = msg.createdAt.toISOString();
      if (!lastId || BigInt(msg.id) > BigInt(lastId)) {
        // New message: update province totals and events
        record(parsed, msg.id, timestamp);
      } else {
        // Already counted in province totals: only add to events for period queries
        addEventOnly(parsed, timestamp);
      }
      processed++;
    }

    lastFetchedId = sorted[sorted.length - 1].id;

    if (messages.size < 100) break;
  }

  console.log(`Backfill complete: ${processed} messages processed.`);
}

module.exports = { backfill };
