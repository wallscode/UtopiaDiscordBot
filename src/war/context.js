// The bot's single AgeManager, EventLog and WarStore, shared by the event
// handlers and the slash commands.

const { AgeManager } = require('./ageManager');
const { EventLog } = require('./eventLog');
const { WarStore } = require('./warStore');

// Days of Discord events kept on disk, and read back from Discord at startup.
const WAR_LOG_RETENTION_DAYS = 30;

const ages = new AgeManager();
const eventLog = new EventLog({ retentionDays: WAR_LOG_RETENTION_DAYS });
const warStore = new WarStore({ ages, eventLog });

// Discord channel -> event kind written to the rolling log.
const LOGGED_CHANNELS = { attacks: 'attack', 'tm-ops': 'espionage', 'self-spells': 'selfspell' };

function init() {
  ages.load();
  const n = eventLog.load();
  const pruned = eventLog.prune();
  console.log(`War data: age ${ages.currentAge}, ${n} logged event(s)`
    + (pruned ? `, pruned ${pruned} old day file(s)` : '')
    + (eventLog.rebuilt ? '; event log format changed, re-reading it from Discord' : '') + '.');
}

// Log the events parsed from one Discord message.
function logMessageEvents(channelName, messageId, events) {
  const kind = LOGGED_CHANNELS[channelName];
  if (!kind) return 0;
  let added = 0;
  events.forEach((event, i) => {
    if (eventLog.append(kind, messageId, i, event)) added++;
  });
  return added;
}

// Pull in whatever Utopia-Automation has written, and top up running wars.
function tick() {
  try {
    for (const r of warStore.processInbox()) {
      if (r.status === 'ingested') console.log(`War data: updated ${r.key}.`);
    }
    warStore.syncOpenWars();
  } catch (err) {
    console.error('War data: inbox processing failed:', err);
  }
}

// After the startup backfill: refresh every war the log fully covers.
function rebuildWars() {
  try {
    for (const r of warStore.rebuildAll()) {
      if (r.before !== r.after) console.log(`War data: ${r.key} events ${r.before} -> ${r.after}.`);
    }
  } catch (err) {
    console.error('War data: rebuilding wars failed:', err);
  }
}

function pendingBanner() {
  if (!ages.pending) return '';
  return `⚠ A new Utopia age (${ages.pending.proposedAge}) has been detected but not confirmed. `
    + 'An admin should run /age-confirm. War data for the new age waits until then.\n';
}

module.exports = {
  ages, eventLog, warStore, init, logMessageEvents, tick, rebuildWars, pendingBanner, LOGGED_CHANNELS,
  WAR_LOG_RETENTION_DAYS,
};
