// Turns Kingdom News attack lines into structured records.
//
// The wording follows UtopiaFormatter's parser (parseAttackLine), which was
// built against live news. A province reads "16 - Name (5:7)"; an attacker the
// game hides reads "An unknown province from Kingdom name (5:7)".
//
//   A captured 123 acres of land from B.               capture
//   A invaded B and captured 105 acres of land.        capture
//   A (5:7), captured ... / razed ...                  conquest (comma after A)
//   A recaptured 47 acres of land from B.              ambush
//   A ambushed armies from B and took 31 acres...      ambush
//   A killed 2,038 people within B.                    massacre
//   A invaded B and killed 2,038 people.               massacre
//   A razed 50 acres of B. / A invaded B and razed...  raze
//   A attacked/invaded and pillaged B.                 plunder
//   A attacked/invaded and looted B ... books          learn
//   A disrupted the scientists ability of B ...        learn
//   A attempted to invade B. / attempted an invasion   bounce

const PROVINCE_RE = /(\d+) - ([^()]+?) \((\d+):(\d+)\)/g;
const UNKNOWN_RE = /^An unknown province from ([^()]+?) \((\d+):(\d+)\)/;

const CAPTURED_RE = /captured ([\d,]+) acres of land/;
const RECAPTURED_RE = /recaptured ([\d,]+) acres of land/;
const AMBUSHED_RE = /ambushed armies.*and took ([\d,]+) acres of land/;
const MASSACRE_RE = /killed ([\d,]+) people/;
const RAZE_RE = /razed ([\d,]+) acres/;
const PLUNDER_RE = /attacked and pillaged|invaded and pillaged/;
const LEARN_RE = /invaded and looted|attacked and looted|disrupted the scientists ability/;
const BOOKS_RE = /([\d,]+)\s+books/;
const BOUNCE_RE = /attempted to invade|attempted an invasion/;

const DECLARED_RE = /\((\d+:\d+)\) has declared WAR with our kingdom/;
const WE_DECLARED_RE = /Our kingdom has declared WAR (?:on|with|against) .*?\((\d+:\d+)\)/i;
const POST_WAR_RE = /post-war period/;

function num(s) {
  return s ? parseInt(s.replace(/,/g, ''), 10) : 0;
}

function province(m) {
  return { number: parseInt(m[1], 10), name: m[2].trim(), kd: `${m[3]}:${m[4]}` };
}

// Parse one news report (the text after the date). Returns null for lines
// that aren't attacks (dragons, rituals, declarations, ...).
function parseNewsAttack(text) {
  const line = text.trim();
  let type = null;
  let acres = 0;
  let people = 0;
  let books = 0;
  let razed = 0;

  if (BOUNCE_RE.test(line)) type = 'bounce';
  else if (RECAPTURED_RE.test(line)) { type = 'ambush'; acres = num(line.match(RECAPTURED_RE)[1]); }
  else if (AMBUSHED_RE.test(line)) { type = 'ambush'; acres = num(line.match(AMBUSHED_RE)[1]); }
  else if (CAPTURED_RE.test(line)) { type = 'capture'; acres = num(line.match(CAPTURED_RE)[1]); }
  else if (MASSACRE_RE.test(line)) { type = 'massacre'; people = num(line.match(MASSACRE_RE)[1]); }
  else if (RAZE_RE.test(line)) { type = 'raze'; razed = num(line.match(RAZE_RE)[1]); }
  else if (PLUNDER_RE.test(line)) type = 'plunder';
  else if (LEARN_RE.test(line)) { type = 'learn'; books = num(line.match(BOOKS_RE)?.[1]); }
  if (!type) return null;

  const provinces = [...line.matchAll(PROVINCE_RE)];
  let attacker;
  let defender;
  const unknown = line.match(UNKNOWN_RE);
  if (unknown) {
    attacker = { number: null, name: null, kd: `${unknown[2]}:${unknown[3]}`, unknown: true };
    // The kingdom name has no slot number, so the only province is the defender.
    defender = provinces[0] ? province(provinces[0]) : null;
  } else if (provinces.length >= 2) {
    attacker = province(provinces[0]);
    defender = province(provinces[1]);
  }
  if (!attacker || !defender) return null;

  // A conquest puts a comma straight after the attacker's coordinates.
  if ((type === 'capture' || type === 'raze') && /^[^()]*\(\d+:\d+\),/.test(line)) type = 'conquest';

  return { type, attacker, defender, acres, people, books, razed };
}

// The opponent named by a war declaration line, if this is one.
function declaredOpponent(text) {
  return text.match(DECLARED_RE)?.[1] ?? text.match(WE_DECLARED_RE)?.[1] ?? null;
}

function isPostWarNotice(text) {
  return POST_WAR_RE.test(text);
}

// Our kingdom is whichever kingdom, other than the opponent, takes part in the
// most attacks in the war's news.
function detectOwnKingdom(attacks, opponent) {
  const counts = new Map();
  for (const a of attacks) {
    for (const kd of [a.attacker.kd, a.defender.kd]) {
      if (kd !== opponent) counts.set(kd, (counts.get(kd) || 0) + 1);
    }
  }
  let best = null;
  for (const [kd, n] of counts) if (!best || n > best[1]) best = [kd, n];
  return best ? best[0] : null;
}

module.exports = { parseNewsAttack, declaredOpponent, isPostWarNotice, detectOwnKingdom };
