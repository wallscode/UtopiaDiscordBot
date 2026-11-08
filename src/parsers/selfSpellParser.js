// #self-spells lines, cast by a province on itself:
// :star2::green_heart: Province code#  <<__fertile lands__>> **16** | 11.3% guilds (...)
// :star2::broken_heart: Province code#  <<__patriotism__>> __FAIL__ (-3 wizards) | ...

const { getAll: getProvinces } = require('../handlers/provinceStore');

// One or more spaces: some provinces' lines have two after the emoji.
const PREFIX_REGEX = /^:star2::[a-z_]+:\s+/;
const SPELL_REGEX = /<<\s*(.+?)\s*>>/;
const LOST_REGEX = /\(-(\d+) wizards\)/;
const VALUE_REGEX = />>\s*([\d,]+)/;

function clean(content) {
  return content.replace(/__/g, '').replace(/\*\*/g, '');
}

function matchProvinceAtStart(text) {
  const sorted = [...getProvinces()].sort((a, b) => b.length - a.length);
  return sorted.find((p) => text.toLowerCase().startsWith(p.toLowerCase())) ?? null;
}

function parseSelfSpellLine(line) {
  const raw = line.trim();
  if (!raw.startsWith(':star2:')) return null;
  const cleaned = clean(raw);
  const prefix = cleaned.match(PREFIX_REGEX);
  if (!prefix) return null;
  const province = matchProvinceAtStart(cleaned.slice(prefix[0].length));
  if (!province) return null;

  const success = raw.includes(':green_heart:');
  const spell = cleaned.match(SPELL_REGEX)?.[1].trim() ?? 'unknown';
  const lost = cleaned.match(LOST_REGEX);
  const value = success ? cleaned.match(VALUE_REGEX) : null;
  return {
    province,
    spell,
    success,
    lostWizards: lost ? parseInt(lost[1], 10) : 0,
    value: value ? parseInt(value[1].replace(/,/g, ''), 10) : 0,
  };
}

function parseSelfSpellMessage(content, timestamp) {
  const results = [];
  content.split('\n').forEach((line, i) => {
    const event = parseSelfSpellLine(line);
    if (event) results.push({ ...event, line: i, timestamp });
  });
  return results;
}

module.exports = { parseSelfSpellMessage };
