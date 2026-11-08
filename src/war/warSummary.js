// Per-province statistics for one war or several (an age), combining:
//   - Kingdom News: every attack made and received (the complete record).
//   - #attacks: kills, losses and spec credits for our own hits, matched to
//     the news line for the same hit.
//   - #tm-ops: thievery and spells on the opponent, plus Mystic Vortex cast on
//     our own kingdom's provinces (it clears bad spells, so it's reported).
//   - #self-spells: tracked, but only reported when asked for.

const { classify, CATEGORY } = require('../parsers/missionTypes');
const { parseNewsAttack } = require('./newsParser');

const MATCH_BEFORE_MS = 10 * 60 * 1000;
const MATCH_AFTER_MS = 70 * 60 * 1000;

// #attacks attackType -> compatible Kingdom News types.
const COMPATIBLE = {
  capture: ['capture', 'conquest'],
  recapture: ['ambush'],
  learn: ['learn'],
  raze: ['raze', 'conquest'],
  plunder: ['plunder'],
  massacre: ['massacre'],
  unknown: ['bounce', 'capture', 'conquest'],
};

const key = (name) => (name || '').trim().toLowerCase();
const TARGET_KD_RE = /\((\d+:\d+)\)\s*$/;

function emptyProvince(name) {
  return {
    name,
    made: { count: 0, acres: 0, byType: {} },
    taken: { count: 0, acres: 0, byType: {} },
    discord: { matched: 0, unmatched: 0, kills: 0, prisoners: 0, troopLosses: 0, specCredits: 0 },
    ops: {
      vsOpponent: new Map(), // missionType -> { meta, count, success, fail, total }
      thievesLost: 0,
      wizardsLost: 0,
      vortexOwn: { count: 0, success: 0 },
      other: 0,
    },
    selfSpells: new Map(), // spell -> { count, success, fail }
  };
}

function bump(byType, type, a) {
  const t = byType[type] || (byType[type] = { count: 0, acres: 0, people: 0, books: 0, razed: 0 });
  t.count++;
  t.acres += a.acres;
  t.people += a.people;
  t.books += a.books;
  t.razed += a.razed;
}

const gainsLand = (type) => type === 'capture' || type === 'conquest' || type === 'ambush';

// Pair each #attacks event with the Kingdom News line for the same hit.
// Returns Map(newsIndex -> discord event) and the unmatched discord events.
// The game sometimes hides which of our provinces hit ("An unknown province
// from <our kingdom>"); such a line can match too, but a named line wins.
function matchAttacks(newsAttacks, discordAttacks, ownKingdom) {
  const matched = new Map();
  const unmatched = [];
  for (const d of discordAttacks) {
    const t = Date.parse(d.discordTime);
    const types = COMPATIBLE[d.attackType] || COMPATIBLE.unknown;
    const acres = d.landsCapt || d.landsRecapt || 0;
    let best = null;
    newsAttacks.forEach((n, i) => {
      if (matched.has(i) || n.realStart === null) return;
      if (n.attacker.kd !== ownKingdom) return;
      const hidden = Boolean(n.attacker.unknown);
      if (!hidden && key(n.attacker.name) !== key(d.attacker)) return;
      if (key(n.defender.name) !== key(d.target)) return;
      if (d.coords && d.coords !== n.defender.kd) return;
      const dt = t - n.realStart;
      if (dt < -MATCH_BEFORE_MS || dt > MATCH_AFTER_MS) return;
      const sameHit = gainsLand(n.type) && n.acres === acres;
      // A hidden attacker is only credited on a clear match: same land taken.
      if (hidden && !sameHit) return;
      const score = (types.includes(n.type) ? 2 : 0) + (sameHit ? 3 : 0) - (hidden ? 2 : 0)
        - Math.abs(dt - 30 * 60 * 1000) / (60 * 60 * 1000);
      if (!best || score > best.score) best = { i, score };
    });
    if (best) matched.set(best.i, d);
    else unmatched.push(d);
  }
  return { matched, unmatched };
}

function summarize(wars, { includeSelfSpells = false, knownProvinces = [] } = {}) {
  const display = new Map(knownProvinces.map((p) => [key(p), p]));
  const provinces = new Map();
  const prov = (name) => {
    const k = key(name);
    if (!provinces.has(k)) provinces.set(k, emptyProvince(display.get(k) || name.trim()));
    return provinces.get(k);
  };
  const kingdom = {
    made: 0, acresGained: 0, taken: 0, acresLost: 0,
    ops: { count: 0, success: 0, thievery: 0, spells: 0, intel: 0 },
    vortexOwn: 0, unmatchedDiscordAttacks: 0, unknownMade: 0,
  };

  for (const war of wars) {
    const own = war.ownKingdom;
    const opp = war.opponent;

    const newsAttacks = [];
    for (const item of war.news || []) {
      const a = parseNewsAttack(item.text);
      if (a) newsAttacks.push({ ...a, realStart: item.realStart ? Date.parse(item.realStart) : null });
    }

    for (const a of newsAttacks) {
      if (a.attacker.kd === own) {
        // The game sometimes hides which of our provinces hit; those count
        // for the kingdom but no province.
        if (a.attacker.name) {
          const p = prov(a.attacker.name);
          p.made.count++;
          bump(p.made.byType, a.type, a);
          if (gainsLand(a.type)) p.made.acres += a.acres;
        } else {
          kingdom.unknownMade++;
        }
        kingdom.made++;
        if (gainsLand(a.type)) kingdom.acresGained += a.acres;
      }
      if (a.defender.kd === own) {
        const p = prov(a.defender.name);
        p.taken.count++;
        bump(p.taken.byType, a.type, a);
        if (gainsLand(a.type)) p.taken.acres += a.acres;
        kingdom.taken++;
        if (gainsLand(a.type)) kingdom.acresLost += a.acres;
      }
    }

    const events = war.events || [];
    const { matched, unmatched } = matchAttacks(
      newsAttacks, events.filter((e) => e.kind === 'attack'), own);
    for (const [i, d] of matched) {
      const p = prov(d.attacker);
      const a = newsAttacks[i];
      if (a.attacker.unknown) {
        // #attacks names the province the news hid; credit the hit to it.
        p.made.count++;
        bump(p.made.byType, a.type, a);
        if (gainsLand(a.type)) p.made.acres += a.acres;
        kingdom.unknownMade--;
      }
      p.discord.matched++;
      p.discord.kills += d.kills || 0;
      p.discord.prisoners += d.prisoners || 0;
      p.discord.troopLosses += d.troopLosses || 0;
      p.discord.specCredits += d.specCredits || 0;
    }
    for (const d of unmatched) prov(d.attacker).discord.unmatched++;
    kingdom.unmatchedDiscordAttacks += unmatched.length;

    for (const e of events.filter((x) => x.kind === 'espionage')) {
      const p = prov(e.province);
      const targetKd = (e.target || '').match(TARGET_KD_RE)?.[1] ?? null;
      const meta = classify(e.missionType, e.opIcon);
      const isVortex = key(e.missionType) === 'mystic vortex';
      if (targetKd && targetKd === opp) {
        let r = p.ops.vsOpponent.get(meta.label);
        if (!r) p.ops.vsOpponent.set(meta.label, (r = { meta, count: 0, success: 0, fail: 0, total: 0 }));
        r.count++;
        if (e.success) { r.success++; r.total += e.impactValue || 0; } else r.fail++;
        kingdom.ops.count++;
        if (e.success) kingdom.ops.success++;
        if (meta.category === CATEGORY.THIEVERY) kingdom.ops.thievery++;
        else if (meta.category === CATEGORY.SPELL) kingdom.ops.spells++;
        else kingdom.ops.intel++;
      } else if (isVortex && targetKd && targetKd === own) {
        p.ops.vortexOwn.count++;
        if (e.success) p.ops.vortexOwn.success++;
        kingdom.vortexOwn++;
      } else {
        p.ops.other++;
        continue; // losses below are counted for reported ops only
      }
      if (e.lostUnit === 'thieves') p.ops.thievesLost += e.lostCount || 0;
      if (e.lostUnit === 'wizards') p.ops.wizardsLost += e.lostCount || 0;
    }

    if (includeSelfSpells) {
      for (const e of events.filter((x) => x.kind === 'selfspell')) {
        const p = prov(e.province);
        let r = p.selfSpells.get(e.spell);
        if (!r) p.selfSpells.set(e.spell, (r = { count: 0, success: 0, fail: 0 }));
        r.count++;
        if (e.success) r.success++; else r.fail++;
        p.ops.wizardsLost += e.lostWizards || 0;
      }
    }
  }

  return { provinces, kingdom };
}

// Totals for one province's ops on the opponent, by category.
function opsByCategory(p) {
  const out = {
    [CATEGORY.THIEVERY]: { count: 0, success: 0 },
    [CATEGORY.SPELL]: { count: 0, success: 0 },
    [CATEGORY.INTEL]: { count: 0, success: 0 },
  };
  for (const r of p.ops.vsOpponent.values()) {
    out[r.meta.category].count += r.count;
    out[r.meta.category].success += r.success;
  }
  return out;
}

module.exports = { summarize, matchAttacks, opsByCategory, key };
