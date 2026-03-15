const { rebuild } = require('./provinceStore');

const SOURCE_BOT_USERNAME = 'utopiabot';
const SCAN_CHANNELS = ['dragons', 'aid', 'attackers', 'ritual'];
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
const DISCORD_EPOCH = 1420070400000n;

const PATTERNS = [
  /DRAGON (.+?) \[/,
  /RITUAL (.+?) \[/,
  /:moneybag: (.+?) \[/,
  /sent .+? to (.+?) \[/,
  /:crossed_swords: (.+?) \[/,
];

function clean(content) {
  return content.replace(/__/g, '').replace(/\*\*/g, '');
}

function extractProvince(content) {
  const cleaned = clean(content);
  for (const pattern of PATTERNS) {
    const match = cleaned.match(pattern);
    if (match) {
      const candidate = match[1].trim();
      if (candidate.length >= 2) return candidate;
    }
  }
  return null;
}

function timestampToSnowflake(ms) {
  return String((BigInt(ms) - DISCORD_EPOCH) << 22n);
}

async function scanChannel(channel, afterId) {
  const found = new Set();
  let lastFetchedId = afterId;

  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, after: lastFetchedId });
    if (batch.size === 0) break;

    const sorted = [...batch.values()].sort(
      (a, b) => Number(BigInt(a.id) - BigInt(b.id))
    );

    for (const msg of sorted) {
      if (msg.author.username !== SOURCE_BOT_USERNAME) continue;
      const province = extractProvince(msg.content);
      if (province) found.add(province);
    }

    lastFetchedId = sorted[sorted.length - 1].id;
    if (batch.size < 100) break;
  }

  return found;
}

async function scanProvinces(guild) {
  const afterId = timestampToSnowflake(Date.now() - FORTY_EIGHT_HOURS_MS);
  const allProvinces = new Set();

  for (const channelName of SCAN_CHANNELS) {
    const channel = guild.channels.cache.find(
      (c) => c.name === channelName && c.isTextBased()
    );
    if (!channel) {
      console.warn(`Province scan: #${channelName} not found, skipping.`);
      continue;
    }

    const found = await scanChannel(channel, afterId);
    console.log(`Province scan: #${channelName} — ${found.size} provinces found.`);
    for (const p of found) allProvinces.add(p);
  }

  rebuild([...allProvinces]);
  console.log(`Province scan complete: ${allProvinces.size} unique provinces saved.`);
  return allProvinces.size;
}

module.exports = { scanProvinces };
