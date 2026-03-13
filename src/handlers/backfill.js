const { parseMessage } = require('./dragonParser');
const { record, getLastMessageId } = require('./dragonStore');

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

  const lastId = getLastMessageId();
  const twoWeeksAgoSnowflake = timestampToSnowflake(Date.now() - Number(TWO_WEEKS_MS));
  const afterId = lastId || twoWeeksAgoSnowflake;

  console.log(`Backfilling #${channelName} from ${lastId ? `last seen message` : 'two weeks ago'}...`);

  let processed = 0;
  let lastFetchedId = afterId;

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
      record(parsed, msg.id);
      processed++;
    }

    lastFetchedId = sorted[sorted.length - 1].id;

    // If we got fewer than 100 messages, we've reached the end
    if (messages.size < 100) break;
  }

  console.log(`Backfill complete: ${processed} messages processed.`);
}

module.exports = { backfill };
