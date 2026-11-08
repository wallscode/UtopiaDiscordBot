// Keeps /dragon-stats' running totals (data/dragon.json) to the current age.
//
// The totals only ever grew, so after an age change they mixed last age's
// provinces with this age's. Now dragon.json records its age; when it isn't
// the current one (a new age was confirmed, or the file predates this), the
// file is kept as dragon-age-<age>.json (dragon-before-age-<age>.json for an
// untagged one) and the totals are rebuilt from the war event log, counting
// only #dragons messages since the age began.
//
// Run after the startup backfill (so the log is complete) and when a new age
// is confirmed.

const { summarizeDragons } = require('./warSummary');

// Per-province dragon totals from the log since `fromMs`, in dragonStore's
// shape ({ province, goldDonated, bushelsDonated, troopsSent, pointsWeakened }).
function dragonTotalsSince(eventLog, fromMs, nowMs = Date.now()) {
  const events = eventLog.inRange(fromMs, nowMs + 60 * 60 * 1000).filter((e) => e.kind === 'dragon');
  const { provinces } = summarizeDragons([{ events }]);
  return [...provinces.values()].map(({ name, ...t }) => ({ province: name, ...t }));
}

// Returns a description of what it did, or null when nothing was needed.
function ensureDragonAge({ ages, eventLog, store, nowMs = Date.now(), log = console }) {
  const current = ages.currentAge;
  const stored = store.getAge();
  if (stored === current) return null;
  const tickZero = ages.tickZeroMs();
  if (tickZero === null) return null; // the age's start isn't known yet
  const from = tickZero;
  const partial = from < eventLog.coverageStart(nowMs);
  const totals = dragonTotalsSince(eventLog, from, nowMs);
  const archive = stored === null ? `dragon-before-age-${current}.json` : `dragon-age-${stored}.json`;
  store.startAge(current, totals, archive);
  const msg = `Dragon totals: started age ${current} from ${totals.length} province(s) in the event log `
    + `since ${new Date(from).toISOString()}; the previous file is kept as data/${archive}.`;
  log.log(msg);
  if (partial) {
    log.warn(`Dragon totals: the event log only reaches back to ${new Date(eventLog.coverageStart(nowMs)).toISOString()}, `
      + `after age ${current} began, so earlier donations and attacks this age are missing.`);
  }
  return msg;
}

module.exports = { ensureDragonAge, dragonTotalsSince };
