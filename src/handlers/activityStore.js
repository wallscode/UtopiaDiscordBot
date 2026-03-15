const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'activity.json');

// Map of lowercase province name -> { province, timestamp (ISO), action }
let activity = new Map();

function load() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(DATA_FILE)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    activity = new Map(Object.entries(raw));
  } catch {
    console.warn('Could not read activity.json, starting fresh.');
  }
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(Object.fromEntries(activity), null, 2));
}

function update(province, timestamp, action) {
  const key = province.toLowerCase();
  const existing = activity.get(key);
  const ts = new Date(timestamp).getTime();
  if (!existing || ts > new Date(existing.timestamp).getTime()) {
    activity.set(key, { province, timestamp, action });
    save();
  }
}

function getAll() {
  return [...activity.values()];
}

function getProvince(name) {
  return activity.get(name.toLowerCase()) ?? null;
}

module.exports = { load, update, getAll, getProvince };
