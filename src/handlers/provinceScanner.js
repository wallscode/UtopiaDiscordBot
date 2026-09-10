const { rebuild } = require('./provinceStore');

const SOURCE_BOT_USERNAME = 'utopiabot';

// Phase 1: province precedes a [shortcode#] bracket, so extraction is unambiguous.
const BRACKET_CHANNELS = ['dragons', 'aid', 'attacks', 'ritual'];

// Phase 2: province is followed by a bare shortcode ending in '#', with spaces
// possible on both sides of the boundary. Recovered via the rules below.
const SHORTCODE_CHANNELS = ['tm-ops', 'self-spells'];

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const DISCORD_EPOCH = 1420070400000n;

// Capture province and its shortcode together, so phase 2 can resolve nicknames.
const PAIR_PATTERNS = [
  /DRAGON (.+?) \[(.*?)#\]/,
  /RITUAL (.+?) \[(.*?)#\]/,
  /:moneybag: (.+?) \[(.*?)#\]/,
  /:crossed_swords: (.+?) \[(.*?)#\]/,
];

// Aid names the receiver too, but with the full lowercase name and no '#'.
const RECEIVER_PATTERN = / sent .+? to (.+?) \[/;

const EMOJI_PREFIX = /^\s*(:[a-z_0-9]+:)+\s*/;

function clean(content) {
  return content.replace(/__/g, '').replace(/\*\*/g, '');
}

// Batched messages arrive as several lines in one message, so each line is
// handled separately rather than only the first match winning.
function lines(content) {
  return clean(content).split('\n');
}

function scanBracketMessage(content, provinces, shortcodes) {
  for (const line of lines(content)) {
    for (const pattern of PAIR_PATTERNS) {
      const match = line.match(pattern);
      if (!match) continue;
      const province = match[1].trim();
      if (province.length < 2) continue;
      provinces.add(province);
      if (match[2]) shortcodes.add(`${province} ${match[2]}`);
    }
    const receiver = line.match(RECEIVER_PATTERN);
    if (receiver) {
      const province = receiver[1].trim();
      if (province.length >= 2) provinces.add(province);
    }
  }
}

// utopiabot renders the default shortcode as the province name lowercased with
// its last character replaced by '#'. So "<Province> <shortcode>" is exactly
// twice the length of the province name, which pins the split to the midpoint.
// Provinces whose owner set a custom nickname break the rule and fall through.
function deriveFromShortcode(head) {
  if (head.length % 2 !== 0) return null;
  const mid = head.length / 2;
  if (head[mid] !== ' ') return null;
  const province = head.slice(0, mid);
  if (province.toLowerCase().slice(0, -1) !== head.slice(mid + 1)) return null;
  return province;
}

// Text between the emoji prefix and the shortcode's '#', per line.
function shortcodeHeads(content) {
  const heads = [];
  for (const rawLine of lines(content)) {
    const line = rawLine.replace(EMOJI_PREFIX, '');
    const hash = line.indexOf('#');
    if (hash < 1) continue;
    const head = line.slice(0, hash);
    if (head.includes(' ')) heads.push(head);
  }
  return heads;
}

function timestampToSnowflake(ms) {
  return String((BigInt(ms) - DISCORD_EPOCH) << 22n);
}

async function fetchMessages(channel, afterId) {
  const messages = [];
  let lastFetchedId = afterId;

  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, after: lastFetchedId });
    if (batch.size === 0) break;

    const sorted = [...batch.values()].sort(
      (a, b) => Number(BigInt(a.id) - BigInt(b.id))
    );

    for (const msg of sorted) {
      if (msg.author.username === SOURCE_BOT_USERNAME) messages.push(msg);
    }

    lastFetchedId = sorted[sorted.length - 1].id;
    if (batch.size < 100) break;
  }

  return messages;
}

function findChannel(guild, name) {
  const channel = guild.channels.cache.find(
    (c) => c.name === name && c.isTextBased()
  );
  if (!channel) console.warn(`Province scan: #${name} not found, skipping.`);
  return channel;
}

async function scanProvinces(guild) {
  const afterId = timestampToSnowflake(Date.now() - THREE_DAYS_MS);
  const provinces = new Set();
  const shortcodes = new Set();

  // --- Phase 1: deterministic bracket channels ---
  for (const channelName of BRACKET_CHANNELS) {
    const channel = findChannel(guild, channelName);
    if (!channel) continue;

    const before = provinces.size;
    for (const msg of await fetchMessages(channel, afterId)) {
      scanBracketMessage(msg.content, provinces, shortcodes);
    }
    console.log(`Province scan: #${channelName} — ${provinces.size - before} new.`);
  }
  console.log(`Province scan: ${provinces.size} after bracket channels.`);

  // --- Phase 2: recover what the bracket channels missed ---
  const unresolved = new Set();
  for (const channelName of SHORTCODE_CHANNELS) {
    const channel = findChannel(guild, channelName);
    if (!channel) continue;

    const before = provinces.size;
    const heads = new Set();
    for (const msg of await fetchMessages(channel, afterId)) {
      for (const head of shortcodeHeads(msg.content)) heads.add(head);
    }

    for (const head of heads) {
      // Already identified in phase 1, nickname and all.
      if (shortcodes.has(head)) continue;
      const derived = deriveFromShortcode(head);
      if (derived) provinces.add(derived);
      else unresolved.add(head);
    }
    console.log(`Province scan: #${channelName} — ${provinces.size - before} new.`);
  }

  // A province derived in phase 2 may explain a head left over from another channel.
  for (const head of [...unresolved]) {
    if (provinces.has(head.slice(0, head.length / 2))) unresolved.delete(head);
  }

  rebuild([...provinces]);
  console.log(`Province scan complete: ${provinces.size} unique provinces saved.`);
  if (unresolved.size) {
    console.log(`Province scan: ${unresolved.size} unrecognized entries:`);
    for (const u of unresolved) console.log(`  ${u}`);
  }

  return { count: provinces.size, unresolved: [...unresolved] };
}

module.exports = { scanProvinces };
