const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'provinces.json');

let provinces = [];
let updatedAt = null;

function load() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(DATA_FILE)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    provinces = raw.provinces || [];
    updatedAt = raw.updatedAt || null;
  } catch {
    console.warn('Could not read provinces.json, starting empty.');
  }
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ updatedAt, provinces }, null, 2));
}

function rebuild(list) {
  provinces = [...new Set(list)].sort((a, b) => a.localeCompare(b));
  updatedAt = new Date().toISOString();
  save();
}

function getAll() {
  return provinces;
}

function getUpdatedAt() {
  return updatedAt;
}

module.exports = { load, rebuild, getAll, getUpdatedAt };
