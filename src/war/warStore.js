// Per-war records: Kingdom News from Utopia-Automation, plus the Discord
// events (attacks, tm-ops, self-spells) that fell inside the war.
//
// Utopia-Automation writes into data/inbox/ (see its war_data.py):
//   clock.json          the Throne page's game date + minutes to next tick,
//                       written every cycle; feeds the AgeManager.
//   war-<key>.json      the current war's full news, from the declaration up
//                       to and including the post-war notice once it ends.
//                       Rewritten every cycle while the war is on.
//
// Each war is kept at data/ages/<age>/wars/<opponent>_<start date>.json. News
// items keep the real time they were first captured; Discord events keep
// their message time, the time the bot saw them, and the game date they fall
// on. A war's events are copied from the rolling EventLog for the war's
// window: from the start of the declaration's game day to the end of the
// post-war notice's day. Six hours after that the war is closed and nothing
// more is added.

const fs = require('fs');
const path = require('path');
const { DEFAULT_DATA_DIR, readJson, writeJsonAtomic } = require('./jsonFile');
const { dayStartMs, gameDateAt, gameDateTicks, tickZeroFromClock, HOUR_MS } = require('./gameTime');
const { parseNewsAttack, detectOwnKingdom } = require('./newsParser');

const CLOSE_AFTER_MS = 6 * HOUR_MS;
const OPPONENT_RE = /^\d{1,2}:\d{1,2}$/;

function warKey(opponent, startDate) {
  return `${opponent.replace(':', '-')}_${startDate.replace(/\s+/g, '-')}`;
}

class WarStore {
  constructor({ dataDir = DEFAULT_DATA_DIR, ages, eventLog, log = console } = {}) {
    this.dataDir = dataDir;
    this.inbox = path.join(dataDir, 'inbox');
    this.ages = ages;
    this.eventLog = eventLog;
    this.log = log;
  }

  // ── Inbox ──────────────────────────────────────────────────────────────

  processInbox(nowMs = Date.now()) {
    fs.mkdirSync(this.inbox, { recursive: true });
    const results = [];

    const clockFile = path.join(this.inbox, 'clock.json');
    const clock = readJson(clockFile);
    if (clock) {
      const r = this.ages.observeClock(clock);
      if (r.status !== 'ok') this.log.log(`Age tracker: clock ${clock.game_date} -> ${r.status}${r.reason ? ` (${r.reason})` : ''}`);
      fs.rmSync(clockFile, { force: true });
      results.push({ file: 'clock.json', status: r.status });
    }

    for (const name of fs.readdirSync(this.inbox).filter((f) => /^war-.+\.json$/.test(f)).sort()) {
      const file = path.join(this.inbox, name);
      const payload = readJson(file);
      if (!payload || !OPPONENT_RE.test(payload.opponent || '') || !payload.start_date || !Array.isArray(payload.items)) {
        this._setAside(file, name, 'unreadable or incomplete');
        results.push({ file: name, status: 'invalid' });
        continue;
      }
      const timeline = payload.clock ? this.ages.classifyClock(payload.clock) : 'current';
      if (timeline === 'pending') {
        // Belongs to a new age the user hasn't confirmed yet; wait for them.
        results.push({ file: name, status: 'waiting-for-age-confirmation' });
        continue;
      }
      if (timeline === 'other') {
        this._setAside(file, name, "its game clock matches neither this age nor a pending new age");
        results.push({ file: name, status: 'set-aside' });
        continue;
      }
      const war = this.ingest(payload, nowMs);
      fs.rmSync(file, { force: true });
      results.push({ file: name, status: 'ingested', key: war.key });
    }
    return results;
  }

  _setAside(file, name, why) {
    const dir = path.join(this.inbox, 'set-aside');
    fs.mkdirSync(dir, { recursive: true });
    fs.renameSync(file, path.join(dir, `${Date.now()}-${name}`));
    this.log.warn(`War data: set aside ${name}: ${why}.`);
  }

  // ── Wars ───────────────────────────────────────────────────────────────

  warFile(age, key) {
    return path.join(this.ages.ageDir(age), 'wars', `${key}.json`);
  }

  ingest(payload, nowMs = Date.now()) {
    const age = this.ages.currentAge;
    const key = warKey(payload.opponent, payload.start_date);
    const file = this.warFile(age, key);
    const capturedAt = payload.captured_at || new Date(nowMs).toISOString();
    const tickZero = this.ages.tickZeroMs() ?? tickZeroFromClock(payload.clock);

    const war = readJson(file) || {
      key,
      age,
      opponent: payload.opponent,
      startDate: payload.start_date,
      createdAt: capturedAt,
      news: [],
      events: [],
      closed: false,
    };

    // News: keep each item's first-seen time across rewrites. An item is
    // identified by its date, text, and how many identical lines came before
    // it (two identical hits on one day are two items).
    const previous = new Map(war.news.map((n) => [n.id, n]));
    const occurrences = new Map();
    war.news = payload.items.map(({ date, text }) => {
      const base = `${date}\t${text}`;
      const n = occurrences.get(base) || 0;
      occurrences.set(base, n + 1);
      const id = `${base}#${n}`;
      const start = dayStartMs(date, tickZero);
      return {
        id,
        gameDate: date,
        text,
        realStart: start === null ? null : new Date(start).toISOString(),
        firstSeen: previous.get(id)?.firstSeen ?? capturedAt,
        lastSeen: capturedAt,
      };
    });

    war.ended = Boolean(payload.ended);
    war.endDate = payload.end_date || null;
    war.tickZeroAt = tickZero === null ? null : new Date(tickZero).toISOString();
    war.lastCapturedAt = capturedAt;
    war.clocks = [...(war.clocks || []), payload.clock].filter(Boolean).slice(-5);

    const attacks = war.news.map((n) => parseNewsAttack(n.text)).filter(Boolean);
    // The Throne page names our kingdom outright; inferring it from the news
    // is the fallback.
    war.ownKingdom = payload.own_kingdom || detectOwnKingdom(attacks, war.opponent)
      || war.ownKingdom || this.ages.ownKingdom;
    this.ages.setOwnKingdom(war.ownKingdom);

    if (war.closed && !war.ended) war.closed = false; // re-opened by newer news
    this.syncEvents(war, nowMs);
    writeJsonAtomic(file, war);
    return war;
  }

  // Real-time window [start, end) of a war; end is null while it's running.
  window(war) {
    const tz = war.tickZeroAt ? Date.parse(war.tickZeroAt) : null;
    const start = dayStartMs(war.startDate, tz);
    const end = war.ended && war.endDate ? dayStartMs(war.endDate, tz) + HOUR_MS : null;
    return { start, end };
  }

  // Copy events inside the war's window from the rolling log. Returns the
  // number added.
  syncEvents(war, nowMs = Date.now()) {
    if (war.closed || !this.eventLog) return 0;
    const { start, end } = this.window(war);
    if (start === null) return 0;
    const tz = war.tickZeroAt ? Date.parse(war.tickZeroAt) : null;
    const have = new Set(war.events.map((e) => e.id));
    let added = 0;
    for (const e of this.eventLog.inRange(start, end ?? nowMs + HOUR_MS)) {
      if (have.has(e.id)) continue;
      war.events.push({ ...e, gameDate: gameDateAt(Date.parse(e.discordTime), tz) });
      have.add(e.id);
      added++;
    }
    if (added) war.events.sort((a, b) => Date.parse(a.discordTime) - Date.parse(b.discordTime));
    if (end !== null && nowMs > end + CLOSE_AFTER_MS) {
      war.closed = true;
      war.closedAt = new Date(nowMs).toISOString();
    }
    return added;
  }

  // Replace a war's Discord events with what the log holds for its window,
  // closed or not. Only when the log covers the whole window (it holds the
  // last retention period, read back from Discord at startup); returns false
  // otherwise. Run after the startup backfill, so parser fixes and late
  // messages reach wars that already ended. A kind of event the log has none
  // of (say a channel was renamed, or Discord was unreachable) keeps the
  // war's existing events of that kind rather than losing them.
  rebuildEvents(war, nowMs = Date.now()) {
    const { start, end } = this.window(war);
    if (start === null || !this.eventLog || start < this.eventLog.coverageStart(nowMs)) return false;
    const tz = war.tickZeroAt ? Date.parse(war.tickZeroAt) : null;
    const fresh = this.eventLog.inRange(start, end ?? nowMs + HOUR_MS)
      .map((e) => ({ ...e, gameDate: gameDateAt(Date.parse(e.discordTime), tz) }));
    const freshKinds = new Set(fresh.map((e) => e.kind));
    const kept = war.events.filter((e) => !freshKinds.has(e.kind));
    war.events = [...fresh, ...kept]
      .sort((a, b) => Date.parse(a.discordTime) - Date.parse(b.discordTime));
    war.eventsRebuiltAt = new Date(nowMs).toISOString();
    return true;
  }

  rebuildAll(nowMs = Date.now()) {
    const rebuilt = [];
    for (const war of this.listWars()) {
      const before = war.events.length;
      if (!this.rebuildEvents(war, nowMs)) continue;
      writeJsonAtomic(this.warFile(war.age, war.key), war);
      rebuilt.push({ key: war.key, before, after: war.events.length });
    }
    return rebuilt;
  }

  // Keep every unclosed war in the current age up to date with the log.
  syncOpenWars(nowMs = Date.now()) {
    let added = 0;
    for (const war of this.listWars()) {
      if (war.closed) continue;
      const wasClosed = war.closed;
      const n = this.syncEvents(war, nowMs);
      if (n || war.closed !== wasClosed) writeJsonAtomic(this.warFile(war.age, war.key), war);
      added += n;
    }
    return added;
  }

  listWars(age = this.ages.currentAge) {
    const dir = path.join(this.ages.ageDir(age), 'wars');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => readJson(path.join(dir, f)))
      .filter(Boolean)
      .sort((a, b) => gameDateTicks(a.startDate) - gameDateTicks(b.startDate));
  }

  // Age numbers that have a folder under data/ages/, newest first.
  listAges() {
    const root = path.join(this.dataDir, 'ages');
    if (!fs.existsSync(root)) return [];
    return fs.readdirSync(root).filter((d) => /^\d+$/.test(d)).map(Number).sort((a, b) => b - a);
  }

  // The war /war-report shows by default: one still running, else the most
  // recent. Falls back to earlier ages when the current one has no wars yet
  // (just after a new age starts). Returns null if there are none at all.
  latestWar() {
    const root = path.join(this.dataDir, 'ages');
    const ages = fs.existsSync(root)
      ? fs.readdirSync(root).filter((d) => /^\d+$/.test(d)).map(Number)
      : [];
    const order = [this.ages.currentAge, ...ages.filter((a) => a < this.ages.currentAge).sort((a, b) => b - a)];
    for (const age of order) {
      const wars = this.listWars(age);
      if (!wars.length) continue;
      return wars.filter((w) => !w.ended).at(-1) ?? wars.at(-1);
    }
    return null;
  }

  // Wars against an opponent in the current age, most recent first.
  findWars(opponent) {
    return this.listWars().filter((w) => w.opponent === opponent).reverse();
  }
}

module.exports = { WarStore, warKey, OPPONENT_RE };
