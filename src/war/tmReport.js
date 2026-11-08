// The Thief & Mage report Utopia-Automation posts in the forum's
// "War Report N:N" thread, below the war summary.
//
// Built from a war record's #tm-ops events on the enemy kingdom, successes
// only for the rankings:
//   TOP THIEVES / TOP MAGES — top 10 by successful ops of that kind, each with
//     the op they landed most and its total impact.
//   TOP INTEL GATHERERS — top 10 by successful intel ops, with their mix.
//   FULL REPORT — the top 10 by successful thievery + spells, every op type
//     as successes/attempts with impact, losses, and their intel.
//
// Plain text with numbers first on each line: the forum uses a proportional
// font, so only leading padding (sent as &nbsp; by the poster) lines up.
// The first line is how Utopia-Automation finds this post again to update it.

const { classify, CATEGORY, KIND } = require('../parsers/missionTypes');
const { shortGameDate } = require('./gameTime');

const TOP = 10;
const HEADING = 'Thief & Mage Report';
const TARGET_KD_RE = /\((\d+:\d+)\)\s*$/;
const SMALL_WORDS = new Set(['the', 'of', 'on', 'and', 'a', 'to']);

const num = (n) => n.toLocaleString('en-US');

// "rob the towers" -> "Rob the Towers"; "propaganda: specialist" ->
// "Propaganda (Specialist)".
function opName(label) {
  const [base, suffix] = label.split(/:\s*/);
  const title = (s) => s.split(' ')
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
  return suffix ? `${title(base)} (${title(suffix)})` : title(base);
}

function impact(meta, total) {
  if (meta.kind === KIND.NONE || !total) return '';
  if (meta.kind === KIND.DURATION) return `${num(total)} days`;
  if (meta.kind === KIND.CURRENCY) return `${num(total)} ${meta.unit} stolen`;
  return meta.unit ? `${num(total)} ${meta.unit}` : num(total);
}

function warTitle(war) {
  const end = war.ended && war.endDate ? shortGameDate(war.endDate) : 'ongoing';
  return `${HEADING} — War vs ${war.opponent} (${shortGameDate(war.startDate)} – ${end})`;
}

// Per province: every op type on the enemy, with attempts, successes, impact.
function collect(war) {
  const provinces = new Map();
  const totals = { [CATEGORY.THIEVERY]: 0, [CATEGORY.SPELL]: 0, [CATEGORY.INTEL]: 0 };
  for (const e of war.events || []) {
    if (e.kind !== 'espionage') continue;
    const targetKd = (e.target || '').match(TARGET_KD_RE)?.[1];
    const meta = classify(e.missionType, e.opIcon);
    let p = provinces.get(e.province);
    if (!p) {
      p = { name: e.province, ops: new Map(),
        ok: { [CATEGORY.THIEVERY]: 0, [CATEGORY.SPELL]: 0, [CATEGORY.INTEL]: 0 },
        thievesLost: 0, wizardsLost: 0, vortex: 0, vortexOk: 0 };
      provinces.set(e.province, p);
    }
    if (targetKd === war.ownKingdom && meta.label === 'mystic vortex') {
      p.vortex++;
      if (e.success) p.vortexOk++;
      continue;
    }
    if (targetKd !== war.opponent) continue;
    let op = p.ops.get(meta.label);
    if (!op) p.ops.set(meta.label, (op = { meta, tries: 0, ok: 0, total: 0 }));
    op.tries++;
    if (e.success) {
      op.ok++;
      op.total += e.impactValue || 0;
      p.ok[meta.category]++;
      totals[meta.category]++;
    }
    if (e.lostUnit === 'thieves') p.thievesLost += e.lostCount || 0;
    if (e.lostUnit === 'wizards') p.wizardsLost += e.lostCount || 0;
  }
  return { provinces: [...provinces.values()], totals };
}

const byCount = (count) => (a, b) => count(b) - count(a) || a.name.localeCompare(b.name);
const pad = (n, w) => String(n).padStart(w);

function bestOp(p, category) {
  return [...p.ops.values()]
    .filter((o) => o.meta.category === category && o.ok > 0)
    .sort((a, b) => b.ok - a.ok || b.total - a.total || a.meta.label.localeCompare(b.meta.label))[0];
}

function topList(provinces, category, title) {
  const rows = provinces.filter((p) => p.ok[category] > 0)
    .sort(byCount((p) => p.ok[category])).slice(0, TOP);
  if (!rows.length) return [];
  const w = String(rows[0].ok[category]).length;
  const lines = [title];
  for (const p of rows) {
    if (category === CATEGORY.INTEL) {
      const mix = [...p.ops.values()].filter((o) => o.meta.category === category && o.ok > 0)
        .sort((a, b) => b.ok - a.ok || a.meta.label.localeCompare(b.meta.label));
      const shown = mix.slice(0, 3).map((o) => `${opName(o.meta.label)} x${o.ok}`);
      const rest = mix.slice(3).reduce((s, o) => s + o.ok, 0);
      if (rest) shown.push(`+${rest} other`);
      lines.push(`${pad(p.ok[category], w)} | ${p.name} — ${shown.join(', ')}`);
    } else {
      const op = bestOp(p, category);
      const what = impact(op.meta, op.total);
      lines.push(`${pad(p.ok[category], w)} | ${p.name} — ${opName(op.meta.label)} x${op.ok}${what ? `: ${what}` : ''}`);
    }
  }
  return lines;
}

function fullReport(provinces) {
  const damage = (p) => p.ok[CATEGORY.THIEVERY] + p.ok[CATEGORY.SPELL];
  const rows = provinces.filter((p) => damage(p) > 0).sort(byCount(damage)).slice(0, TOP);
  if (!rows.length) return [];
  const lines = [`FULL REPORT — top ${rows.length} provinces by successful thievery + spells`];
  rows.forEach((p, i) => {
    lines.push('');
    lines.push(`${i + 1}. ${p.name} — ${damage(p)} successful (${p.ok[CATEGORY.THIEVERY]} thievery, `
      + `${p.ok[CATEGORY.SPELL]} spells)`);
    const lost = [];
    if (p.thievesLost) lost.push(`${num(p.thievesLost)} thieves`);
    if (p.wizardsLost) lost.push(`${num(p.wizardsLost)} wizards`);
    if (lost.length) lines.push(`   Lost ${lost.join(', ')}`);
    for (const [cat, title] of [[CATEGORY.THIEVERY, 'Thievery'], [CATEGORY.SPELL, 'Spells']]) {
      const ops = [...p.ops.values()].filter((o) => o.meta.category === cat)
        .sort((a, b) => b.ok - a.ok || b.tries - a.tries || a.meta.label.localeCompare(b.meta.label));
      if (!ops.length) continue;
      const w = Math.max(...ops.map((o) => `${o.ok}/${o.tries}`.length));
      lines.push(`   ${title}`);
      for (const o of ops) {
        const what = impact(o.meta, o.total);
        lines.push(`     ${`${o.ok}/${o.tries}`.padEnd(w)} ${opName(o.meta.label)}${what ? `: ${what}` : ''}`);
      }
    }
    const intel = [...p.ops.values()].filter((o) => o.meta.category === CATEGORY.INTEL && o.ok > 0)
      .sort((a, b) => b.ok - a.ok || a.meta.label.localeCompare(b.meta.label));
    if (intel.length) {
      lines.push(`   Intel: ${p.ok[CATEGORY.INTEL]} (${intel.map((o) => `${o.ok} ${opName(o.meta.label)}`).join(', ')})`);
    }
    if (p.vortex) lines.push(`   Mystic Vortex on kingdom-mates: ${p.vortex} (${p.vortexOk} successful)`);
  });
  return lines;
}

function buildTmReport(war) {
  const { provinces, totals } = collect(war);
  const lines = [
    warTitle(war),
    war.ended ? 'Full war.' : 'War so far...',
    `Successful ops on ${war.opponent}: ${num(totals[CATEGORY.THIEVERY])} thievery, `
      + `${num(totals[CATEGORY.SPELL])} spells, ${num(totals[CATEGORY.INTEL])} intel`,
  ];
  const sections = [
    topList(provinces, CATEGORY.THIEVERY, `TOP THIEVES — successful thievery ops on ${war.opponent}`),
    topList(provinces, CATEGORY.SPELL, `TOP MAGES — successful spells on ${war.opponent}`),
    topList(provinces, CATEGORY.INTEL, `TOP INTEL GATHERERS — successful intel ops on ${war.opponent}`),
    fullReport(provinces),
  ].filter((s) => s.length);
  if (!sections.length) lines.push('', 'No tm-ops recorded for this war.');
  for (const s of sections) lines.push('', ...s);
  return lines.join('\n');
}

module.exports = { buildTmReport, warTitle, opName, HEADING };
