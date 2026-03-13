const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'dragon.json');

let provinces = {};
let lastMessageId = null;

function load() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(DATA_FILE)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    provinces = raw.provinces || {};
    lastMessageId = raw.lastMessageId || null;
  } catch {
    console.warn('Could not read dragon.json, starting fresh.');
  }
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ lastMessageId, provinces }, null, 2));
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

function record(parsed, messageId) {
  const entry = getOrCreate(parsed.province);

  if (parsed.type === 'donation') {
    entry.goldDonated += parsed.goldDonated;
    entry.bushelsDonated += parsed.bushelsDonated;
  } else if (parsed.type === 'attack') {
    entry.troopsSent += parsed.troopsSent;
    entry.pointsWeakened += parsed.pointsWeakened;
  }

  if (messageId && (!lastMessageId || BigInt(messageId) > BigInt(lastMessageId))) {
    lastMessageId = messageId;
  }

  save();
}

function getAll() {
  return Object.values(provinces);
}

function getLastMessageId() {
  return lastMessageId;
}

function reset() {
  provinces = {};
  lastMessageId = null;
  save();
}

module.exports = { load, record, getAll, getLastMessageId, reset };
