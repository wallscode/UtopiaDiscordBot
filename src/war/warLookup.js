// Resolve a command's war option: "current" (the war still running, else the
// most recent one) or an enemy kingdom "N:N" (its latest war this age).
// Returns { war } or { error }. `deps` is for tests.

const { OPPONENT_RE } = require('./warStore');

function lookupWar(arg, deps = {}) {
  const context = deps.warStore ? null : require('./context');
  const { warStore = context.warStore, refresh = context && context.tick,
    currentAge = () => context.ages.currentAge } = deps;
  const value = (arg || '').trim().toLowerCase();
  if (value !== 'current' && !OPPONENT_RE.test(value)) {
    return { error: `"${arg}" isn't a war. Use \`current\` or the enemy kingdom, e.g. \`6:7\`.` };
  }
  if (refresh) refresh();
  if (value === 'current') {
    const war = warStore.latestWar();
    return war ? { war } : { error: 'No war recorded yet.' };
  }
  const [war] = warStore.findWars(value);
  return war ? { war } : { error: `No war vs ${value} recorded in age ${currentAge()}.` };
}

module.exports = { lookupWar };
