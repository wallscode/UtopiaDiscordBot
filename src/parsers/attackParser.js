// Format (pipe-delimited, markdown stripped):
// ⚔️ Attacker [code#] attacked Target (X:Y)|<type field>|loss: N UnitType|kills: N (+N prisoners)|return: N.NN|...
//
// Attack types (mutually exclusive outcome field):
//   captured:    N  — land capture
//   recaptured:  N  — land recapture
//   learn:       N  — learn attack (books earned)
//   razed:       N  — raze attack (acres destroyed)
//   plundered:   N gold coins, N bushels and N runes
//   killed:      N  — massacre (civilians killed)

const ATTACKER_REGEX  = /([^[\]]+?) \[.*?\] attacked/;
const EMOJI_PREFIX    = /^(?::crossed_swords:|⚔\uFE0F?)\s*/;
const TARGET_REGEX    = /attacked (.+?) \(/;
const COORDS_REGEX    = /\((\d+:\d+)\)/;
const CAPTURES_REGEX  = /captured:\s+([\d,]+)/;
const RECAPT_REGEX    = /recaptured:\s+([\d,]+)/;
const LEARN_REGEX     = /learn:\s+([\d,]+)/;
const RAZED_REGEX     = /razed:\s+([\d,]+)/;
const PLUNDER_REGEX   = /plundered:\s+(.+?)(?:\||$)/;
const MASSACRE_REGEX  = /killed:\s+([\d,]+)/;
const LOSS_REGEX      = /loss: (.+?)(?:\||$)/;
const KILLS_REGEX     = /kills: ([\d,]+)/;
const PRISONERS_REGEX = /\(\+([\d,]+) prisoners\)/;
const RETURN_REGEX    = /return: ([\d.]+)/;
const SPEC_REGEX      = /([\d,]+) spec creds/;
const PEASANTS_REGEX  = /([\d,]+) peasants/;
const OFF_REGEX       = /([\d,]+)off\b/;
const GENS_REGEX      = /\((\d+) gens\)/;

const PLUNDER_GOLD_REGEX    = /([\d,]+)\s+gold coins?/;
const PLUNDER_BUSHELS_REGEX = /([\d,]+)\s+bushels/;
const PLUNDER_RUNES_REGEX   = /([\d,]+)\s+runes/;

function clean(content) {
  return content.replace(/__/g, '').replace(/\*\*/g, '');
}

function parseNum(str) {
  return str ? parseInt(str.replace(/,/g, ''), 10) : 0;
}

function parseTroopLosses(lossStr) {
  if (!lossStr) return 0;
  const nums = lossStr.match(/\d[\d,]*/g) ?? [];
  return nums.reduce((sum, n) => sum + parseNum(n), 0);
}

function parsePlunder(plunderStr) {
  if (!plunderStr) return { plunderGold: 0, plunderBushels: 0, plunderRunes: 0 };
  return {
    plunderGold:    parseNum(plunderStr.match(PLUNDER_GOLD_REGEX)?.[1]),
    plunderBushels: parseNum(plunderStr.match(PLUNDER_BUSHELS_REGEX)?.[1]),
    plunderRunes:   parseNum(plunderStr.match(PLUNDER_RUNES_REGEX)?.[1]),
  };
}

function getAttackType(event) {
  if (event.landsCapt > 0)    return 'capture';
  if (event.landsRecapt > 0)  return 'recapture';
  if (event.learnPts > 0)     return 'learn';
  if (event.landsRazed > 0)   return 'raze';
  if (event.plunderGold + event.plunderBushels + event.plunderRunes > 0) return 'plunder';
  if (event.massacred > 0)    return 'massacre';
  return 'unknown';
}

function parseAttackLine(line) {
  const cleaned = clean(line);

  const attackerMatch = cleaned.match(ATTACKER_REGEX);
  if (!attackerMatch) return null;

  const targetMatch = cleaned.match(TARGET_REGEX);
  if (!targetMatch) return null;

  const lossStr      = cleaned.match(LOSS_REGEX)?.[1] ?? '';
  const plunderStr   = cleaned.match(PLUNDER_REGEX)?.[1]?.trim() ?? '';
  const plunder      = parsePlunder(plunderStr);

  const event = {
    attacker:       attackerMatch[1].replace(EMOJI_PREFIX, '').trim(),
    target:         targetMatch[1].trim(),
    coords:         cleaned.match(COORDS_REGEX)?.[1] ?? '',
    landsCapt:      parseNum(cleaned.match(CAPTURES_REGEX)?.[1]),
    landsRecapt:    parseNum(cleaned.match(RECAPT_REGEX)?.[1]),
    learnPts:       parseNum(cleaned.match(LEARN_REGEX)?.[1]),
    landsRazed:     parseNum(cleaned.match(RAZED_REGEX)?.[1]),
    plunderGold:    plunder.plunderGold,
    plunderBushels: plunder.plunderBushels,
    plunderRunes:   plunder.plunderRunes,
    massacred:      parseNum(cleaned.match(MASSACRE_REGEX)?.[1]),
    troopLossStr:   lossStr.trim(),
    troopLosses:    parseTroopLosses(lossStr),
    kills:          parseNum(cleaned.match(KILLS_REGEX)?.[1]),
    prisoners:      parseNum(cleaned.match(PRISONERS_REGEX)?.[1]),
    returnTime:     parseFloat(cleaned.match(RETURN_REGEX)?.[1] ?? '0'),
    specCredits:    parseNum(cleaned.match(SPEC_REGEX)?.[1]),
    peasants:       parseNum(cleaned.match(PEASANTS_REGEX)?.[1]),
    offPts:         parseNum(cleaned.match(OFF_REGEX)?.[1]),
    generals:       parseNum(cleaned.match(GENS_REGEX)?.[1]),
  };
  event.attackType = getAttackType(event);
  return event;
}

function parseAttackMessage(content, timestamp) {
  const results = [];
  for (const line of content.split('\n')) {
    const event = parseAttackLine(line.trim());
    if (event) results.push({ ...event, timestamp });
  }
  return results;
}

module.exports = { parseAttackMessage };
