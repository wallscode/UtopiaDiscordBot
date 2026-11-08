const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'dragon.json');

let provinces = {};
let lastMessageId = null;
// The Utopia age the totals belong to (null: an older file from before ages
// were tracked). See war/dragonAge.js, which starts the totals afresh at
// each new age.
let age = null;
let events = []; // { type, province, goldDonated, bushelsDonated, troopsSent, pointsWeakened, timestamp }

function load() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(DATA_FILE)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    provinces = raw.provinces || {};
    lastMessageId = raw.lastMessageId || null;
    age = raw.age ?? null;
    // events are not persisted — rebuilt from Discord on each startup
  } catch {
    console.warn('Could not read dragon.json, starting fresh.');
  }
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ age, lastMessageId, provinces }, null, 2));
}

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

function record(parsed, messageId, timestamp) {
  const entry = getOrCreate(parsed.province);

  if (parsed.type === 'donation') {
    entry.goldDonated += parsed.goldDonated;
    entry.bushelsDonated += parsed.bushelsDonated;
  } else if (parsed.type === 'attack') {
    entry.troopsSent += parsed.troopsSent;
    entry.pointsWeakened += parsed.pointsWeakened;
  }

  if (timestamp) {
    events.push({
      type: parsed.type,
      province: parsed.province,
      goldDonated: parsed.goldDonated || 0,
      bushelsDonated: parsed.bushelsDonated || 0,
      troopsSent: parsed.troopsSent || 0,
      pointsWeakened: parsed.pointsWeakened || 0,
      timestamp,
    });
  }

  if (messageId && (!lastMessageId || BigInt(messageId) > BigInt(lastMessageId))) {
    lastMessageId = messageId;
  }

  save();
}

// Add an event-only entry without updating province totals.
// Used during backfill for messages already counted in provinces.
function addEventOnly(parsed, timestamp) {
  events.push({
    type: parsed.type,
    province: parsed.province,
    goldDonated: parsed.goldDonated || 0,
    bushelsDonated: parsed.bushelsDonated || 0,
    troopsSent: parsed.troopsSent || 0,
    pointsWeakened: parsed.pointsWeakened || 0,
    timestamp,
  });
}

function getAll() {
  return Object.values(provinces);
}

// Returns per-province aggregates filtered to the given period (hours).
// Falls back to all-time aggregated provinces when no period is specified.
function getAggregated(periodHours) {
  if (!periodHours) return Object.values(provinces);

  const cutoff = Date.now() - periodHours * 60 * 60 * 1000;
  const filtered = events.filter((e) => new Date(e.timestamp).getTime() >= cutoff);

  const byProvince = {};
  for (const e of filtered) {
    if (!byProvince[e.province]) {
      byProvince[e.province] = {
        province: e.province,
        goldDonated: 0,
        bushelsDonated: 0,
        troopsSent: 0,
        pointsWeakened: 0,
      };
    }
    byProvince[e.province].goldDonated += e.goldDonated;
    byProvince[e.province].bushelsDonated += e.bushelsDonated;
    byProvince[e.province].troopsSent += e.troopsSent;
    byProvince[e.province].pointsWeakened += e.pointsWeakened;
  }
  return Object.values(byProvince);
}

function getLastMessageId() {
  return lastMessageId;
}

function getAge() {
  return age;
}

// Start the totals for a new age: keep a copy of the current file as
// `archiveName` (in data/), then replace the totals with `totals` (per
// province, e.g. rebuilt from the war event log since the age began).
// lastMessageId is kept, so the startup backfill never counts an older
// message again.
function startAge(newAge, totals, archiveName) {
  if (fs.existsSync(DATA_FILE)) fs.copyFileSync(DATA_FILE, path.join(DATA_DIR, archiveName));
  age = newAge;
  provinces = {};
  for (const t of totals) {
    provinces[t.province] = {
      province: t.province,
      goldDonated: t.goldDonated || 0,
      bushelsDonated: t.bushelsDonated || 0,
      troopsSent: t.troopsSent || 0,
      pointsWeakened: t.pointsWeakened || 0,
    };
  }
  save();
}

function reset() {
  provinces = {};
  lastMessageId = null;
  save();
}

module.exports = {
  load, record, addEventOnly, getAll, getAggregated, getLastMessageId, reset, getAge, startAge,
};
