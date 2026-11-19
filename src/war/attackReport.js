// The Attacker Report Utopia-Automation posts in the forum's "War Report N:N"
// thread, as its own post below the War Report and the Thief & Mage report.
//
// Built from a war record's #attacks events on the enemy kingdom (#attacks
// always names the attacker, so hits the Kingdom News hides are credited
// too), plus two things only the Kingdom News has: bounces, and the hits each
// province took from the enemy.
//
//   Header — kingdom totals: hits, offense sent, land captured, kills.
//   TOP ATTACKERS — every province that hit the enemy, by total offense sent.
//   FULL REPORT — the same provinces in the same order, one block each.
//
// Counting rules:
//   - Every attack is a hit (captures, recaptures, razes, massacres, ...).
//   - Land captured is captures and recaptures alike; razed land is shown
//     only on the province's own Land line, never in the totals.
//   - Kills are troops killed plus people massacred.
//
// Plain text with numbers first on the top list: the forum uses a
// proportional font, so only leading padding (sent as &nbsp; by the poster)
// lines up. The first line is how Utopia-Automation finds this post again.

const { parseNewsAttack } = require('./newsParser');
const { shortGameDate } = require('./gameTime');

const HEADING = 'Attacker Report';
const LAND_TYPES = new Set(['capture', 'conquest', 'ambush']);

const num = (n) => Math.round(n).toLocaleString('en-US');
const key = (name) => (name || '').trim().toLowerCase();
const plural = (n, one, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;

function warTitle(war) {
  const end = war.ended && war.endDate ? shortGameDate(war.endDate) : 'ongoing';
  return `${HEADING} — War vs ${war.opponent} (${shortGameDate(war.startDate)} – ${end})`;
}

function emptyProvince(name) {
  return {
    name, hits: 0, offense: 0, offenses: [],
    land: 0, landHits: 0, razed: 0, razeHits: 0, massacred: 0, massacreHits: 0,
    kills: 0, prisoners: 0, losses: 0, units: new Map(), generals: new Map(),
    returnTotal: 0, returnHits: 0, bounces: 0, takenHits: 0, takenAcres: 0,
  };
}

// "1,722 Drakes and 641 Griffins" / "2 soldiers, 170 Night Rangers and 331 horses"
function lossUnits(text) {
  const units = [];
  // A list comma has a space after it; a thousands comma ("1,722") doesn't.
  for (const part of (text || '').split(/,\s+|\s+and\s+/)) {
    const m = part.trim().match(/^([\d,]+)\s+(.+)$/);
    if (m) units.push([m[2].trim(), Number(m[1].replace(/,/g, ''))]);
  }
  return units;
}

function collect(war) {
  const provinces = new Map();
  for (const e of war.events || []) {
    if (e.kind !== 'attack' || e.coords !== war.opponent) continue;
    const k = key(e.attacker);
    if (!provinces.has(k)) provinces.set(k, emptyProvince(e.attacker.trim()));
    const p = provinces.get(k);
    p.hits++;
    if (e.offPts) { p.offense += e.offPts; p.offenses.push(e.offPts); }
    // Records saved before the recapture fix carry the acres in both fields.
    const acres = e.landsRecapt || e.landsCapt || 0;
    if (acres) { p.land += acres; p.landHits++; }
    if (e.landsRazed) { p.razed += e.landsRazed; p.razeHits++; }
    if (e.massacred) { p.massacred += e.massacred; p.massacreHits++; }
    p.kills += e.kills || 0;
    p.prisoners += e.prisoners || 0;
    p.losses += e.troopLosses || 0;
    for (const [unit, n] of lossUnits(e.troopLossStr)) p.units.set(unit, (p.units.get(unit) || 0) + n);
    if (e.generals) p.generals.set(e.generals, (p.generals.get(e.generals) || 0) + 1);
    if (e.returnTime) { p.returnTotal += e.returnTime; p.returnHits++; }
  }

  for (const item of war.news || []) {
    const a = parseNewsAttack(item.text);
    if (!a) continue;
    if (a.attacker.kd === war.ownKingdom && a.defender.kd === war.opponent && a.type === 'bounce') {
      const p = provinces.get(key(a.attacker.name));
      if (p) p.bounces++;
    }
    if (a.attacker.kd === war.opponent && a.defender.kd === war.ownKingdom && a.type !== 'bounce') {
      const p = provinces.get(key(a.defender.name));
      if (p) {
        p.takenHits++;
        if (LAND_TYPES.has(a.type)) p.takenAcres += a.acres || 0;
      }
    }
  }

  return [...provinces.values()]
    .sort((a, b) => b.offense - a.offense || a.name.localeCompare(b.name));
}

const allKills = (p) => p.kills + p.massacred;

function topList(rows, opponent) {
  const w = Math.max(...rows.map((p) => num(p.offense).length));
  return [
    `TOP ATTACKERS — total offense sent on ${opponent}`,
    ...rows.map((p) => `${num(p.offense).padStart(w)} | ${p.name} — ${plural(p.hits, 'hit')}, `
      + `${num(p.land)} acres, ${num(allKills(p))} kills`),
  ];
}

function provinceBlock(p, i, opponent) {
  const lines = [`${i + 1}. ${p.name} — ${num(p.offense)} offense in ${plural(p.hits, 'hit')}`];

  const land = [`${num(p.land)} acres captured in ${plural(p.landHits, 'hit')}`];
  if (p.razeHits) land.push(`${num(p.razed)} acres razed in ${plural(p.razeHits, 'hit')}`);
  lines.push(`   Land: ${land.join(' · ')}`);
  if (p.massacreHits) lines.push(`   Massacre: ${num(p.massacred)} killed in ${plural(p.massacreHits, 'hit')}`);

  if (p.offenses.length) {
    lines.push(`   Offense: ${num(p.offense / p.offenses.length)} avg · biggest ${num(Math.max(...p.offenses))}`
      + ` · smallest ${num(Math.min(...p.offenses))}`);
  }

  const kills = p.massacred
    ? `${num(allKills(p))} (${num(p.kills)} troops + ${num(p.massacred)} massacred)`
    : `${num(p.kills)} troops`;
  lines.push(`   Kills: ${kills} · ${num(p.prisoners)} prisoners taken`);

  const units = [...p.units].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([unit, n]) => `${num(n)} ${unit}`);
  lines.push(`   Losses: ${num(p.losses)}${units.length ? ` (${units.join(', ')})` : ''}`);

  if (p.generals.size) {
    const used = [...p.generals].sort((a, b) => a[0] - b[0]).map(([g, n]) => `${n}×${g}`);
    lines.push(`   Generals Used: ${used.join(', ')}`);
  }
  if (p.returnHits) lines.push(`   Average Attack Speed: ${(p.returnTotal / p.returnHits).toFixed(1)} hours`);
  if (p.bounces) lines.push(`   Bounces: ${num(p.bounces)}`);
  lines.push(`   Hit by ${opponent}: ${plural(p.takenHits, 'time')}, ${num(p.takenAcres)} acres lost`);
  return lines;
}

function buildAttackReport(war) {
  const rows = collect(war);
  const sum = (fn) => rows.reduce((s, p) => s + fn(p), 0);
  const lines = [
    warTitle(war),
    war.ended ? 'Full war.' : 'War so far...',
    `Hits on ${war.opponent}: ${num(sum((p) => p.hits))} | Offense sent: ${num(sum((p) => p.offense))}`
      + ` | Land captured: ${num(sum((p) => p.land))} acres | Kills: ${num(sum(allKills))}`,
  ];
  if (!rows.length) {
    lines.push('', 'No attacks recorded for this war.');
    return lines.join('\n');
  }
  lines.push('', ...topList(rows, war.opponent));
  lines.push('', `FULL REPORT — every province that attacked ${war.opponent}, by total offense sent`);
  rows.forEach((p, i) => lines.push('', ...provinceBlock(p, i, war.opponent)));
  return lines.join('\n');
}

module.exports = { buildAttackReport, warTitle, lossUnits, HEADING };
