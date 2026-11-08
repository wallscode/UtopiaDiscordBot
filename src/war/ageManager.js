// Tracks which Utopia age we're in, and how game dates map to real time.
//
// State lives in data/age.json. The age's "tick zero" (the real time January 1
// of YR0 began) comes from Throne clock readings that Utopia-Automation drops
// in data/inbox/clock.json every cycle. Every reading of the same age yields
// the same tick zero (within a little rounding), so:
//
//   - A reading that agrees with the stored tick zero is the normal case.
//   - A reading that disagrees is ignored on its own: one misread page must
//     never change anything.
//   - A new age resets the date to YR0, so the tick zero jumps forward by
//     weeks. Only when TWO readings, at least 50 minutes apart, agree on the
//     same new tick zero does it become a *pending* age change, and even then
//     nothing is switched until the user confirms (terminal or /age-confirm).
//     A new age renames every province and renumbers every kingdom, so it is
//     treated as a big deal.
//   - Two agreeing readings that differ by less than a week (say the game
//     skipped ticks during maintenance) are adopted quietly as drift.
//
// Data is stored per age under data/ages/<age>/ and is never deleted without
// the user's say-so. Ages 3+ behind the current one are offered for deletion
// at startup, with a "don't ask again until next age" option.

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { DEFAULT_DATA_DIR, readJson, writeJsonAtomic } = require('./jsonFile');
const { tickZeroFromClock, gameDateAt, HOUR_MS } = require('./gameTime');

const INITIAL_AGE = 117;
const SAME_TOLERANCE_MS = 3 * HOUR_MS;
const AGE_JUMP_MIN_MS = 7 * 24 * HOUR_MS;
const CONFIRM_GAP_MS = 50 * 60 * 1000;
const CANDIDATE_TTL_MS = 3 * 24 * HOUR_MS;
const OLD_AGE_DISTANCE = 3;

function iso(ms) {
  return new Date(ms).toISOString();
}

class AgeManager extends EventEmitter {
  constructor({ dataDir = DEFAULT_DATA_DIR, initialAge = INITIAL_AGE } = {}) {
    super();
    this.dataDir = dataDir;
    this.file = path.join(dataDir, 'age.json');
    this.initialAge = initialAge;
    this.state = null;
  }

  load() {
    const saved = readJson(this.file);
    this.state = {
      currentAge: this.initialAge,
      tickZeroAt: null,
      lastClock: null,
      ownKingdom: null,
      candidates: [],
      pending: null,
      rejected: [],
      cleanupSnoozedForAge: null,
      ...(saved || {}),
    };
    if (!saved) this.save();
    return this.state;
  }

  save() {
    writeJsonAtomic(this.file, this.state);
  }

  get currentAge() { return this.state.currentAge; }
  get pending() { return this.state.pending; }
  get ownKingdom() { return this.state.ownKingdom; }

  tickZeroMs() {
    return this.state.tickZeroAt ? Date.parse(this.state.tickZeroAt) : null;
  }

  ageDir(age = this.state.currentAge) {
    return path.join(this.dataDir, 'ages', String(age));
  }

  setOwnKingdom(kd) {
    if (kd && this.state.ownKingdom !== kd) {
      this.state.ownKingdom = kd;
      this.save();
    }
  }

  // Which timeline a clock reading belongs to: 'current', 'pending', or
  // 'other' (unusable, or a stray reading that matches neither).
  classifyClock(clock) {
    const tz = tickZeroFromClock(clock);
    if (tz === null) return 'other';
    const current = this.tickZeroMs();
    if (current === null || Math.abs(tz - current) <= SAME_TOLERANCE_MS) return 'current';
    if (this.state.pending && Math.abs(tz - Date.parse(this.state.pending.tickZeroAt)) <= SAME_TOLERANCE_MS) {
      return 'pending';
    }
    return 'other';
  }

  // Feed one Throne clock reading. Returns { status, ... } describing what it
  // did; emits 'pending' when a new age change is first proposed.
  observeClock(clock) {
    const tz = tickZeroFromClock(clock);
    if (tz === null) return { status: 'unusable' };
    const s = this.state;

    if (s.tickZeroAt === null) {
      s.tickZeroAt = iso(tz);
      s.lastClock = clock;
      this.save();
      return { status: 'initialized' };
    }

    const diff = tz - Date.parse(s.tickZeroAt);
    if (Math.abs(diff) <= SAME_TOLERANCE_MS) {
      s.lastClock = clock;
      s.candidates = [];
      this.save();
      return { status: 'ok' };
    }

    if (s.pending) {
      return Math.abs(tz - Date.parse(s.pending.tickZeroAt)) <= SAME_TOLERANCE_MS
        ? { status: 'pending' }
        : { status: 'ignored', reason: 'a new age is already awaiting confirmation' };
    }

    if (s.rejected.some((r) => Math.abs(tz - Date.parse(r)) <= SAME_TOLERANCE_MS)) {
      return { status: 'rejected' };
    }

    // Keep this reading as a candidate and look for an earlier one, read at
    // least CONFIRM_GAP_MS before it, that agrees with it.
    const readAt = Date.parse(clock.read_at);
    s.candidates = s.candidates.filter((c) => readAt - Date.parse(c.read_at) < CANDIDATE_TTL_MS);
    const agreeing = s.candidates.find((c) =>
      Math.abs(Date.parse(c.tickZeroAt) - tz) <= SAME_TOLERANCE_MS
      && readAt - Date.parse(c.read_at) >= CONFIRM_GAP_MS);
    s.candidates.push({ tickZeroAt: iso(tz), game_date: clock.game_date, read_at: clock.read_at });

    if (!agreeing) {
      this.save();
      return { status: 'candidate', diffHours: Math.round(diff / HOUR_MS) };
    }

    if (diff > AGE_JUMP_MIN_MS) {
      s.pending = {
        tickZeroAt: iso(tz),
        proposedAge: s.currentAge + 1,
        detectedAt: new Date().toISOString(),
        lastOldGameDate: gameDateAt(readAt, Date.parse(s.tickZeroAt)),
        readings: [agreeing, { game_date: clock.game_date, read_at: clock.read_at }],
        lastClock: clock,
      };
      s.candidates = [];
      this.save();
      this.emit('pending', s.pending);
      return { status: 'pending-new' };
    }

    if (Math.abs(diff) < AGE_JUMP_MIN_MS) {
      // Same age, but the game's clock moved (skipped or extra ticks).
      s.tickZeroAt = iso(tz);
      s.lastClock = clock;
      s.candidates = [];
      this.save();
      return { status: 'drift-adopted', diffHours: Math.round(diff / HOUR_MS) };
    }

    // The date jumped forward by more than a week: not something the game
    // does, so keep ignoring it.
    this.save();
    return { status: 'ignored', reason: 'game date jumped forward' };
  }

  // Switch to the pending age. `age` overrides the proposed number.
  confirmAgeChange(age) {
    const p = this.state.pending;
    if (!p) throw new Error('No age change is pending.');
    const newAge = Number.isInteger(age) ? age : p.proposedAge;
    Object.assign(this.state, {
      currentAge: newAge,
      tickZeroAt: p.tickZeroAt,
      lastClock: p.lastClock,
      ownKingdom: null,
      candidates: [],
      pending: null,
    });
    this.save();
    fs.mkdirSync(path.join(this.ageDir(newAge), 'wars'), { recursive: true });
    this.emit('age-changed', newAge);
    return newAge;
  }

  rejectAgeChange() {
    const p = this.state.pending;
    if (!p) throw new Error('No age change is pending.');
    this.state.rejected.push(p.tickZeroAt);
    this.state.pending = null;
    this.state.candidates = [];
    this.save();
  }

  // Age folders at least OLD_AGE_DISTANCE ages behind the current one.
  oldAges() {
    const root = path.join(this.dataDir, 'ages');
    if (!fs.existsSync(root)) return [];
    return fs.readdirSync(root)
      .filter((d) => /^\d+$/.test(d) && fs.statSync(path.join(root, d)).isDirectory())
      .map(Number)
      .filter((n) => n <= this.state.currentAge - OLD_AGE_DISTANCE)
      .sort((a, b) => a - b);
  }

  needsCleanupPrompt() {
    return this.oldAges().length > 0 && this.state.cleanupSnoozedForAge !== this.state.currentAge;
  }

  deleteOldAges() {
    const ages = this.oldAges();
    for (const age of ages) {
      fs.rmSync(this.ageDir(age), { recursive: true, force: true });
    }
    return ages;
  }

  snoozeCleanup() {
    this.state.cleanupSnoozedForAge = this.state.currentAge;
    this.save();
  }

  describePending() {
    const p = this.state.pending;
    if (!p) return null;
    const seen = p.readings.map((r) => `${r.game_date} (read ${r.read_at})`).join(' and ');
    return `New Utopia age detected: the Throne page reported ${seen}, but age `
      + `${this.state.currentAge} should be around ${p.lastOldGameDate ?? 'a later date'} by now. `
      + `Confirming starts age ${p.proposedAge}: new province names and kingdom numbers, `
      + `and new war data goes in a new folder. Age ${this.state.currentAge}'s data is kept.`;
  }
}

module.exports = { AgeManager, INITIAL_AGE, SAME_TOLERANCE_MS, AGE_JUMP_MIN_MS, CONFIRM_GAP_MS };
