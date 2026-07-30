// :detective::green_heart: Province code#  <<mission | Target (coords)>>|details
// :detective::broken_heart: Province code#  <<mission | Target (coords)>> FAIL (-N thieves)|details
// :comet::green_heart:/:comet::broken_heart: same format for spells

const { getAll: getProvinces } = require('../handlers/provinceStore');

const PREFIX_REGEX = /^:(detective|comet)::[a-z_]+: /;
const SUCCESS_REGEX = /:green_heart:/;
const FAIL_REGEX = /:broken_heart:/;
const MISSION_REGEX = /<<(.+?)\s*\|/;
const TARGET_REGEX = /\|\s*(.+?)\s*>>/;
const LOST_REGEX = /\(-(\d+) (thieves|wizards)\)/;
const IMPACT_REGEX = />>\s*([\d,]+)\s*\|/;

function clean(content) {
  return content.replace(/__/g, '').replace(/\*\*/g, '');
}

function matchProvinceAtStart(text) {
  const provinces = getProvinces();
  const sorted = [...provinces].sort((a, b) => b.length - a.length);
  for (const p of sorted) {
    if (text.toLowerCase().startsWith(p.toLowerCase())) return p;
  }
  return null;
}

function parseEspionageLine(line) {
  const raw = line.trim();
  if (!raw.match(/^:(?:detective|comet):/)) return null;

  const cleaned = clean(raw);
  const prefixMatch = cleaned.match(PREFIX_REGEX);
  if (!prefixMatch) return null;

  const afterPrefix = cleaned.slice(prefixMatch[0].length);
  const province = matchProvinceAtStart(afterPrefix);
  if (!province) return null;

  const success = raw.includes(':green_heart:');
  const missionMatch = cleaned.match(MISSION_REGEX);
  const targetMatch = cleaned.match(TARGET_REGEX);
  const lostMatch = cleaned.match(LOST_REGEX);
  const impactMatch = success ? cleaned.match(IMPACT_REGEX) : null;

  return {
    province,
    missionType: missionMatch?.[1].trim() ?? 'unknown',
    opIcon: prefixMatch[1],
    target: targetMatch?.[1].trim() ?? 'unknown',
    success,
    lostCount: lostMatch ? parseInt(lostMatch[1], 10) : 0,
    lostUnit: lostMatch ? lostMatch[2] : null,
    impactValue: impactMatch ? parseInt(impactMatch[1].replace(/,/g, ''), 10) : 0,
  };
}

function parseEspionageMessage(content, timestamp) {
  const results = [];
  for (const line of content.split('\n')) {
    const event = parseEspionageLine(line.trim());
    if (event) results.push({ ...event, timestamp });
  }
  return results;
}

module.exports = { parseEspionageMessage };
