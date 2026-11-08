// Text for /war-report and /age-report. Plain monospace text, sent in code
// blocks by sendChunked.

const { CATEGORY, KIND } = require('../parsers/missionTypes');
const { formatNum, formatAvg } = require('../commands/commandUtils');
const { shortGameDate } = require('./gameTime');
const { opsByCategory, key } = require('./warSummary');

const TYPE_ORDER = ['capture', 'conquest', 'ambush', 'raze', 'massacre', 'learn', 'plunder', 'bounce'];
const SECTIONS = [
  [CATEGORY.THIEVERY, 'THIEVERY'],
  [CATEGORY.SPELL, 'SPELLS'],
  [CATEGORY.INTEL, 'INTEL'],
];

const pct = (ok, n) => (n ? `${Math.round((ok / n) * 100)}%` : '-');
const pad = (s, n) => String(s).padStart(n);
const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s).padEnd(n);

function warRange(war) {
  const start = shortGameDate(war.startDate);
  if (!war.ended) return `${start} – ongoing`;
  return `${start} – ${shortGameDate(war.endDate)}`;
}

function realRange(window) {
  const fmt = (ms) => new Date(ms).toISOString().slice(5, 16).replace('T', ' ');
  if (window.start === null) return '';
  const end = window.end ?? Date.now();
  const hours = Math.round((end - window.start) / 3600000);
  return `${fmt(window.start)} – ${window.end ? fmt(window.end) : 'now'} UTC (${hours}h)`;
}

function typeSummary(byType, { withPeople = true } = {}) {
  const parts = [];
  for (const t of TYPE_ORDER) {
    const r = byType[t];
    if (!r) continue;
    let s = `${r.count} ${t}`;
    if (r.acres) s += ` ${formatNum(r.acres)}a`;
    if (withPeople && r.people) s += ` ${formatNum(r.people)} people`;
    if (r.books) s += ` ${formatNum(r.books)} books`;
    if (r.razed) s += ` ${formatNum(r.razed)}a razed`;
    parts.push(s);
  }
  return parts.join(', ');
}

function kingdomLines(summary, opponentLabel) {
  const k = summary.kingdom;
  const net = k.acresGained - k.acresLost;
  return [
    `Hits made: ${formatNum(k.made)} (+${formatNum(k.acresGained)} acres`
      + (k.unknownMade ? `, ${k.unknownMade} by unnamed provinces` : '') + ')   '
      + `Hits taken: ${formatNum(k.taken)} (-${formatNum(k.acresLost)} acres)   `
      + `Net: ${net >= 0 ? '+' : ''}${formatNum(net)}`,
    `Ops on ${opponentLabel}: ${formatNum(k.ops.count)} (${pct(k.ops.success, k.ops.count)} success) — `
      + `${formatNum(k.ops.thievery)} thievery, ${formatNum(k.ops.spells)} spells, ${formatNum(k.ops.intel)} intel`
      + (k.vortexOwn ? `   Mystic Vortex on kingdom-mates: ${k.vortexOwn}` : ''),
  ];
}

function provinceTable(summary) {
  // Most hits first, then most acres, then most ops (the Ops column).
  const opsCount = (p) => {
    const c = opsByCategory(p);
    return c[CATEGORY.THIEVERY].count + c[CATEGORY.SPELL].count;
  };
  const rows = [...summary.provinces.values()]
    .sort((a, b) => b.made.count - a.made.count || b.made.acres - a.made.acres
      || opsCount(b) - opsCount(a) || a.name.localeCompare(b.name));
  const lines = [
    `${'Province'.padEnd(20)} ${pad('Hits', 4)} ${pad('+Acres', 7)} ${pad('Hit', 4)} ${pad('-Acres', 7)} `
      + `${pad('Ops', 5)} ${pad('Success', 7)} ${pad('Intel', 5)}`,
    '-'.repeat(66),
  ];
  for (const p of rows) {
    const c = opsByCategory(p);
    const ops = c[CATEGORY.THIEVERY].count + c[CATEGORY.SPELL].count;
    const ok = c[CATEGORY.THIEVERY].success + c[CATEGORY.SPELL].success;
    const intel = c[CATEGORY.INTEL].success;
    lines.push(`${trunc(p.name, 20)} ${pad(p.made.count, 4)} ${pad(formatNum(p.made.acres), 7)} `
      + `${pad(p.taken.count, 4)} ${pad(formatNum(p.taken.acres), 7)} ${pad(formatNum(ops), 5)} `
      + `${pad(pct(ok, ops), 7)} ${pad(formatNum(intel), 5)}`);
  }
  lines.push('');
  lines.push('Hits/+Acres: attacks made (Kingdom News). Hit/-Acres: attacks received.');
  lines.push('Ops/Success: thievery + spells on the enemy (#tm-ops) and their success rate.');
  lines.push('Intel: successful intel ops on the enemy.');
  return lines;
}

function opRow(r) {
  const base = `  ${pad(r.count, 3)}  ${r.meta.label.padEnd(22)} ${pad(r.success, 3)} ok ${pad(r.fail, 3)} fail ${pad(pct(r.success, r.count), 4)}`;
  if (r.meta.kind === KIND.NONE || r.success === 0) return base;
  const avg = r.success > 1 ? ` (avg ${formatAvg(r.total / r.success)})` : '';
  return `${base}  ${formatNum(r.total)} ${r.meta.unit}${avg}`;
}

function provinceDetail(p, opponentLabel, { includeSelfSpells }) {
  const lines = [p.name, '='.repeat(Math.min(p.name.length, 40))];
  lines.push(`Hits made: ${p.made.count} (+${formatNum(p.made.acres)} acres)`
    + (p.made.count ? `  — ${typeSummary(p.made.byType)}` : ''));
  const d = p.discord;
  if (d.matched) {
    lines.push(`  From #attacks (${d.matched} of ${p.made.count} hits): kills ${formatNum(d.kills)}`
      + (d.prisoners ? ` (+${formatNum(d.prisoners)} prisoners)` : '')
      + `, troops lost ${formatNum(d.troopLosses)}, spec credits ${formatNum(d.specCredits)}`);
  }
  if (d.unmatched) lines.push(`  ${d.unmatched} #attacks message(s) with no matching Kingdom News line`);
  lines.push(`Hits taken: ${p.taken.count} (-${formatNum(p.taken.acres)} acres)`
    + (p.taken.count ? `  — ${typeSummary(p.taken.byType)}` : ''));

  const byLabel = [...p.ops.vsOpponent.values()];
  for (const [cat, title] of SECTIONS) {
    const rows = byLabel.filter((r) => r.meta.category === cat).sort((a, b) => b.count - a.count);
    if (!rows.length) continue;
    const n = rows.reduce((s, r) => s + r.count, 0);
    const ok = rows.reduce((s, r) => s + r.success, 0);
    lines.push('');
    lines.push(`${title} on ${opponentLabel}: ${n} ops, ${ok} ok, ${n - ok} fail (${pct(ok, n)})`);
    for (const r of rows) lines.push(opRow(r));
  }
  const lost = [];
  if (p.ops.thievesLost) lost.push(`${formatNum(p.ops.thievesLost)} thieves`);
  if (p.ops.wizardsLost) lost.push(`${formatNum(p.ops.wizardsLost)} wizards`);
  if (lost.length) lines.push(`Lost on ops: ${lost.join(', ')}`);
  if (p.ops.vortexOwn.count) {
    lines.push(`Mystic Vortex on kingdom-mates: ${p.ops.vortexOwn.count} (${p.ops.vortexOwn.success} ok)`);
  }
  if (p.ops.other) lines.push(`Other ops (not on ${opponentLabel}): ${p.ops.other}`);
  if (includeSelfSpells && p.selfSpells.size) {
    lines.push('');
    lines.push('SELF-SPELLS');
    for (const [spell, r] of [...p.selfSpells].sort((a, b) => b[1].count - a[1].count)) {
      lines.push(`  ${pad(r.count, 3)}  ${spell.padEnd(22)} ${pad(r.success, 3)} ok ${pad(r.fail, 3)} fail`);
    }
  }
  return lines;
}

function findProvince(summary, name) {
  const k = key(name);
  return summary.provinces.get(k)
    || [...summary.provinces.values()].find((p) => key(p.name).startsWith(k))
    || null;
}

function formatWarReport({ war, window, summary, age, province, includeSelfSpells, otherWars = 0 }) {
  const opp = war.opponent;
  const lines = [
    `WAR vs ${opp} — ${warRange(war)} — Age ${age}${war.ended ? '' : ' (still running)'}`,
  ];
  const real = realRange(window);
  if (real) lines.push(real);
  if (otherWars) lines.push(`(${otherWars} earlier war(s) vs ${opp} this age; showing the latest)`);
  lines.push('');

  if (province) {
    const p = findProvince(summary, province);
    if (!p) return `No war data for a province named "${province}" in the war vs ${opp}.`;
    lines.push(...provinceDetail(p, opp, { includeSelfSpells }));
    return lines.join('\n');
  }
  lines.push(...kingdomLines(summary, opp));
  lines.push('');
  lines.push(...provinceTable(summary));
  lines.push('Add province:<name> for one province\'s full breakdown.');
  return lines.join('\n');
}

// windows: each war's real-time window (WarStore.window), same order as wars.
function formatAgeReport({ age, wars, windows = [], perWar, summary, province, includeSelfSpells, current = true }) {
  const first = wars[0];
  const last = wars.at(-1);
  const span = `${shortGameDate(first.startDate)} – `
    + (last.ended ? shortGameDate(last.endDate) : 'ongoing');
  const lines = [`AGE ${age} — ${span} — ${wars.length} war(s)${current ? '' : ' (past age)'}`];

  // Real time: first war's start to the last war's end, and hours at war.
  const starts = windows.map((w) => w.start).filter((t) => t !== null);
  if (starts.length) {
    const fmt = (ms) => new Date(ms).toISOString().slice(5, 16).replace('T', ' ');
    const atWar = windows.reduce((h, w) => (w.start === null ? h
      : h + Math.round(((w.end ?? Date.now()) - w.start) / 3600000)), 0);
    const lastEnd = windows.at(-1).end;
    lines.push(`${fmt(Math.min(...starts))} – ${lastEnd ? fmt(lastEnd) : 'now'} UTC (${atWar}h at war)`);
  }
  lines.push('');

  const warLines = ['WARS'];
  wars.forEach((war, i) => {
    const k = perWar[i].kingdom;
    const net = k.acresGained - k.acresLost;
    warLines.push(`  vs ${war.opponent.padEnd(5)} ${warRange(war).padEnd(26)} `
      + `hits ${pad(k.made, 4)} made ${pad(k.taken, 4)} taken  net ${net >= 0 ? '+' : ''}${formatNum(net)}`);
  });

  if (province) {
    const p = findProvince(summary, province);
    if (!p) return `No war data for a province named "${province}" in age ${age}.`;
    lines.push(...warLines, '');
    lines.push(...provinceDetail(p, 'the enemy', { includeSelfSpells }));
    return lines.join('\n');
  }
  lines.push(...kingdomLines(summary, 'enemies'));
  lines.push('');
  lines.push(...warLines);
  lines.push('');
  lines.push(...provinceTable(summary));
  lines.push('Add province:<name> for one province\'s full breakdown.');
  return lines.join('\n');
}

module.exports = { formatWarReport, formatAgeReport, warRange };
