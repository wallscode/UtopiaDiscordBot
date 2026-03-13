// In-memory store mapping province name -> aggregated stats
const provinces = {};

function getOrCreate(province) {
  if (!provinces[province]) {
    provinces[province] = {
      province,
      goldDonated: 0,
      bushelsDonated: 0,
      troopsSent: 0,
      pointsWeakened: 0,
    };
  }
  return provinces[province];
}

function record(parsed) {
  const entry = getOrCreate(parsed.province);

  if (parsed.type === 'donation') {
    entry.goldDonated += parsed.goldDonated;
    entry.bushelsDonated += parsed.bushelsDonated;
  } else if (parsed.type === 'attack') {
    entry.troopsSent += parsed.troopsSent;
    entry.pointsWeakened += parsed.pointsWeakened;
  }
}

function getAll() {
  return Object.values(provinces);
}

function reset() {
  for (const key of Object.keys(provinces)) {
    delete provinces[key];
  }
}

module.exports = { record, getAll, reset };
