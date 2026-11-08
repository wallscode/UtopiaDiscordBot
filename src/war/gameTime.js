// Utopia game time <-> real time.
//
// One game day is one tick, and ticks happen on the real-world hour. A year is
// 7 months of 24 days (168 ticks). Ages start at January 1 of YR0.
//
// The link between the two clocks is a "clock reading" from the Throne page,
// which shows e.g. "May 22 of YR9 (next tick: 28 minutes)". From that we know
// the real time the current game day began, and from there the real time of
// tick 0 (January 1 of YR0) for the whole age: the age's "tick zero".

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july'];
const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July'];
const DAYS_PER_MONTH = 24;
const TICKS_PER_YEAR = MONTHS.length * DAYS_PER_MONTH;
const HOUR_MS = 60 * 60 * 1000;

function parseGameDate(str) {
  if (typeof str !== 'string') return null;
  const m = str.trim().match(/^(\w+)\s+(\d{1,2})\s+of\s+YR(\d+)$/i);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase());
  const day = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (month === -1 || day < 1 || day > DAYS_PER_MONTH) return null;
  return { year, month, day };
}

function toTicks({ year, month, day }) {
  return year * TICKS_PER_YEAR + month * DAYS_PER_MONTH + (day - 1);
}

function fromTicks(ticks) {
  const year = Math.floor(ticks / TICKS_PER_YEAR);
  const rest = ticks - year * TICKS_PER_YEAR;
  return { year, month: Math.floor(rest / DAYS_PER_MONTH), day: (rest % DAYS_PER_MONTH) + 1 };
}

function formatGameDate({ year, month, day }) {
  return `${MONTH_LABELS[month]} ${day} of YR${year}`;
}

// "February 20 of YR2" -> "Feb 20 YR2", for compact report headers.
function shortGameDate(str) {
  const d = parseGameDate(str);
  if (!d) return str;
  return `${MONTH_LABELS[d.month].slice(0, 3)} ${d.day} YR${d.year}`;
}

function gameDateTicks(str) {
  const d = parseGameDate(str);
  return d ? toTicks(d) : null;
}

// Real time (ms) that tick 0 of the age began, from one Throne clock reading:
// { game_date, minutes_to_next_tick, read_at }. Returns null if unusable.
// Ticks land on the hour, so the day's start is rounded to the nearest hour;
// that also absorbs the page's minute-level rounding.
function tickZeroFromClock(clock) {
  if (!clock) return null;
  const date = parseGameDate(clock.game_date);
  const readAt = Date.parse(clock.read_at);
  if (!date || Number.isNaN(readAt)) return null;
  const minutes = Number(clock.minutes_to_next_tick);
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 60) return null;
  const nextTick = readAt + minutes * 60 * 1000;
  const dayStart = Math.round((nextTick - HOUR_MS) / HOUR_MS) * HOUR_MS;
  return dayStart - toTicks(date) * HOUR_MS;
}

// Real time (ms) a game day began, given the age's tick zero.
function dayStartMs(gameDateStr, tickZeroMs) {
  const ticks = gameDateTicks(gameDateStr);
  if (ticks === null || tickZeroMs === null || tickZeroMs === undefined) return null;
  return tickZeroMs + ticks * HOUR_MS;
}

// Game date in effect at a real time, given the age's tick zero.
function gameDateAt(ms, tickZeroMs) {
  if (tickZeroMs === null || tickZeroMs === undefined) return null;
  const ticks = Math.floor((ms - tickZeroMs) / HOUR_MS);
  if (ticks < 0) return null;
  return formatGameDate(fromTicks(ticks));
}

module.exports = {
  MONTHS, MONTH_LABELS, DAYS_PER_MONTH, TICKS_PER_YEAR, HOUR_MS,
  parseGameDate, toTicks, fromTicks, formatGameDate, shortGameDate, gameDateTicks,
  tickZeroFromClock, dayStartMs, gameDateAt,
};
