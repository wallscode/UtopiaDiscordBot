/**
 * extract-provinces.js
 *
 * Reads all channel dumps and extracts province names from utopiabot messages.
 * Uses keyword-anchored patterns specific to each message type.
 *
 * Run: node src/scripts/extract-provinces.js
 */

const fs = require('fs');
const path = require('path');

const DUMP_DIR = path.join(__dirname, '../../data/channel-dumps');
const SOURCE_BOT = 'utopiabot';

// Each pattern captures a province name anchored to a known keyword/emoji.
// All patterns extract group 1 as the province name.
const PATTERNS = [
  // :dragon_face: __DRAGON__ Province Name [encoded#] donated ...
  /DRAGON (.+?) \[/,
  // :pray:__RITUAL__ Province Name [encoded#] cast ...
  /RITUAL (.+?) \[/,
  // :moneybag: Province Name [encoded#] sent ... (sender)
  /:moneybag: (.+?) \[/,
  // :moneybag: ... sent X to Province Name [encoded#] (receiver)
  /sent .+? to (.+?) \[/,
  // :crossed_swords: Province Name [**encoded#**] attacked ...
  /:crossed_swords: (.+?) \[/,
  // :detective:emoji: Province Name encoded#  <<operation (tms)
  /:detective:[^:]+: (.+?) \w+#/,
  // :comet:emoji: Province Name encoded#  <<spell (tms)
  /:comet:[^:]+: (.+?) \w+#/,
];

function clean(content) {
  return content.replace(/__/g, '').replace(/\*\*/g, '');
}

function extractFromMessage(content) {
  const cleaned = clean(content);
  const found = new Set();
  for (const pattern of PATTERNS) {
    const match = cleaned.match(pattern);
    if (match) {
      const candidate = match[1].trim();
      if (candidate.length >= 2) {
        found.add(candidate);
      }
    }
  }
  return found;
}

// Known provinces for validation
const KNOWN_PROVINCES = new Set([
  'Time to Shine',
  'your time is up Give in',
  'RazorclawTime',
  'Waste of Time',
  'Time to play',
  'Slack Time',
  'Slow Attack times',
  'No Better Time',
  'Fun times',
  'Timeless Rock Band',
  'Stewies Time Machine',
  'Misstress Of Time',
  'Time',
  'About time dude',
  'Father time',
  'Ill be there in a tick',
  'Pee Time',
  'Sushi Sampo Time',
  'Tea time',
  'Its 5 OClock Somewhere',
  'ticking time',
  'Age of time',
  'Time Manipulator',
]);

function main() {
  const files = fs.readdirSync(DUMP_DIR).filter((f) => f.endsWith('.json'));
  const provinceCounts = new Map();

  for (const file of files) {
    const channelName = file.replace('.json', '');
    const messages = JSON.parse(fs.readFileSync(path.join(DUMP_DIR, file), 'utf8'));
    const botMessages = messages.filter((m) => m.author === SOURCE_BOT);

    let channelHits = 0;
    for (const msg of botMessages) {
      const found = extractFromMessage(msg.content);
      for (const p of found) {
        provinceCounts.set(p, (provinceCounts.get(p) ?? 0) + 1);
        channelHits++;
      }
    }
    if (botMessages.length > 0) {
      console.log(`#${channelName}: ${botMessages.length} bot messages, ${channelHits} province extractions`);
    }
  }

  const sorted = [...provinceCounts.entries()].sort((a, b) => b[1] - a[1]);
  const extracted = new Set(provinceCounts.keys());

  console.log(`\n--- Extracted ${extracted.size} unique province candidates ---\n`);

  const matched = [];
  const unmatched = [];
  for (const [name, count] of sorted) {
    if (KNOWN_PROVINCES.has(name)) {
      matched.push({ name, count });
    } else {
      unmatched.push({ name, count });
    }
  }

  console.log(`MATCHED (${matched.length}/${KNOWN_PROVINCES.size} known provinces found):`);
  for (const { name, count } of matched) {
    console.log(`  ✓  ${name} (${count}x)`);
  }

  const missed = [...KNOWN_PROVINCES].filter((p) => !extracted.has(p));
  if (missed.length > 0) {
    console.log(`\nMISSED (in known list but not extracted):`);
    for (const name of missed) console.log(`  ✗  ${name}`);
  }

  if (unmatched.length > 0) {
    console.log(`\nUNMATCHED candidates (extracted but not in known list — possible false positives):`);
    for (const { name, count } of unmatched) {
      console.log(`  ?  ${name} (${count}x)`);
    }
  }
}

main();
