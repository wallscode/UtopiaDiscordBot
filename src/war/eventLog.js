// Rolling on-disk log of parsed Discord events (attacks, tm-ops, self-spells).
//
// One JSON Lines file per UTC day under data/events/, named by the day of the
// Discord message. Lines are only ever appended, so a reader never sees a file
// half rewritten; at worst the last line is incomplete and is skipped.
//
// The log is a buffer: wars copy the events inside their window out of it
// (warStore), and files older than the retention period are deleted. Every
// event carries a stable id built from the Discord message id and the line
// within the message, so the startup backfill, which re-reads Discord, adds
// nothing twice. (Line, not position among parsed events: messages can mix
// provinces, so a parser fix that recognizes more lines would shift positions.)
//
// The log is only a copy of Discord. If its id format changes (FORMAT_VERSION),
// it is cleared at load and the startup backfill reads it in again.

const fs = require('fs');
const path = require('path');
const { DEFAULT_DATA_DIR } = require('./jsonFile');

const DAY_MS = 24 * 60 * 60 * 1000;
const FILE_RE = /^(\d{4}-\d{2}-\d{2})\.jsonl$/;
const FORMAT_VERSION = 2;

class EventLog {
  constructor({ dataDir = DEFAULT_DATA_DIR, retentionDays = 14 } = {}) {
    this.dir = path.join(dataDir, 'events');
    this.retentionDays = retentionDays;
    this.ids = new Set();
    this.loaded = false;
  }

  load() {
    fs.mkdirSync(this.dir, { recursive: true });
    this.ids.clear();
    this.rebuilt = false;
    const formatFile = path.join(this.dir, 'format.json');
    let version = null;
    try { version = JSON.parse(fs.readFileSync(formatFile, 'utf8')).version; } catch { /* none yet */ }
    if (version !== FORMAT_VERSION) {
      const old = this._files();
      for (const file of old) fs.unlinkSync(path.join(this.dir, file));
      fs.writeFileSync(formatFile, JSON.stringify({ version: FORMAT_VERSION }) + '\n');
      this.rebuilt = old.length > 0;
    }
    for (const file of this._files()) {
      for (const record of this._readFile(file)) this.ids.add(record.id);
    }
    this.loaded = true;
    return this.ids.size;
  }

  // kind: 'attack' | 'espionage' | 'selfspell'. The event's `line` (its line
  // number in the message, set by the parsers) identifies it; `index`, its
  // position among the parsed events, is only a fallback.
  append(kind, messageId, index, event, seenAt = new Date().toISOString()) {
    if (!this.loaded) this.load();
    const id = `${kind}:${messageId}:L${event.line ?? index}`;
    if (this.ids.has(id)) return false;
    const { timestamp, ...fields } = event;
    const record = { id, kind, messageId, discordTime: timestamp, seenAt, ...fields };
    const day = timestamp.slice(0, 10);
    fs.appendFileSync(path.join(this.dir, `${day}.jsonl`), JSON.stringify(record) + '\n');
    this.ids.add(id);
    return true;
  }

  // Events whose Discord time falls in [startMs, endMs).
  inRange(startMs, endMs) {
    const out = [];
    for (const file of this._files()) {
      const dayStart = Date.parse(file.slice(0, 10) + 'T00:00:00Z');
      if (dayStart + DAY_MS <= startMs || dayStart >= endMs) continue;
      for (const record of this._readFile(file)) {
        const t = Date.parse(record.discordTime);
        if (t >= startMs && t < endMs) out.push(record);
      }
    }
    return out.sort((a, b) => Date.parse(a.discordTime) - Date.parse(b.discordTime));
  }

  // From when the log holds everything Discord has: the startup backfill
  // reads back the retention period.
  coverageStart(nowMs = Date.now()) {
    return nowMs - this.retentionDays * DAY_MS;
  }

  prune(nowMs = Date.now()) {
    const cutoff = nowMs - (this.retentionDays + 1) * DAY_MS;
    let removed = 0;
    for (const file of this._files()) {
      const dayStart = Date.parse(file.slice(0, 10) + 'T00:00:00Z');
      if (dayStart + DAY_MS <= cutoff) {
        for (const record of this._readFile(file)) this.ids.delete(record.id);
        fs.unlinkSync(path.join(this.dir, file));
        removed++;
      }
    }
    return removed;
  }

  _files() {
    if (!fs.existsSync(this.dir)) return [];
    return fs.readdirSync(this.dir).filter((f) => FILE_RE.test(f)).sort();
  }

  _readFile(file) {
    const out = [];
    const text = fs.readFileSync(path.join(this.dir, file), 'utf8');
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try {
        out.push(JSON.parse(line));
      } catch {
        // A line cut short by a crash mid-append; skip it.
      }
    }
    return out;
  }
}

module.exports = { EventLog };
