// In-memory store for all parsed channel events.
// Rebuilt from Discord on each startup via eventBackfill.

const events = {
  aid: [],        // { sender, receiver, resource, amount, timestamp }
  attacks: [],    // { attacker, target, kills, prisoners, learnPts, landsCapt, specCredits, troopLosses, timestamp }
  rituals: [],    // { province, castCount, timestamp }
  espionage: [],  // { province, missionType, target, success, thievesLost, goldStolen, timestamp }
};

function addAid(event) { events.aid.push(event); }
function addAttack(event) { events.attacks.push(event); }
function addRitual(event) { events.rituals.push(event); }
function addEspionage(event) { events.espionage.push(event); }

function filterByPeriod(arr, periodHours) {
  if (!periodHours) return arr;
  const cutoff = Date.now() - periodHours * 60 * 60 * 1000;
  return arr.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
}

function filterByProvince(arr, field, name) {
  const lower = name.toLowerCase();
  return arr.filter((e) => e[field].toLowerCase() === lower);
}

function getAid(periodHours) { return filterByPeriod(events.aid, periodHours); }
function getAttacks(periodHours) { return filterByPeriod(events.attacks, periodHours); }
function getRituals(periodHours) { return filterByPeriod(events.rituals, periodHours); }
function getEspionage(periodHours) { return filterByPeriod(events.espionage, periodHours); }

module.exports = {
  addAid, addAttack, addRitual, addEspionage,
  getAid, getAttacks, getRituals, getEspionage,
  filterByProvince,
};
