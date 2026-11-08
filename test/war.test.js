// node --test   (run from the repo root)

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const gt = require('../src/war/gameTime');
const { AgeManager } = require('../src/war/ageManager');
const { EventLog } = require('../src/war/eventLog');
const { WarStore } = require('../src/war/warStore');
const { parseNewsAttack, detectOwnKingdom } = require('../src/war/newsParser');
const { summarize } = require('../src/war/warSummary');
const { formatWarReport, formatAgeReport } = require('../src/war/reportFormat');
const { getAll: getProvinces } = require('../src/handlers/provinceStore');
const { parseSelfSpellMessage } = require('../src/parsers/selfSpellParser');
const { parseEspionageMessage } = require('../src/parsers/espionageParser');
const { parseAttackMessage } = require('../src/parsers/attackParser');

const H = 3600 * 1000;
const quiet = { log() {}, warn() {} };

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'warbot-'));
}

// A clock reading taken `minutesIn` minutes into the game day `gameDate`,
// where that day began at real time `dayStartMs`.
function clockAt(gameDate, dayStartMs, minutesIn = 20) {
  return {
    game_date: gameDate,
    minutes_to_next_tick: 60 - minutesIn,
    read_at: new Date(dayStartMs + minutesIn * 60000).toISOString(),
  };
}

const T0 = Date.parse('2026-09-01T00:00:00Z'); // tick zero of the test age
const dayStart = (date, tz = T0) => gt.dayStartMs(date, tz);

for (const name of ['Jurassic Park', 'The 5th Element', 'underworld', 'Sleepers']) {
  if (!getProvinces().includes(name)) getProvinces().push(name);
}

// ── game time ────────────────────────────────────────────────────────────

test('game dates round-trip through ticks, including YR0', () => {
  assert.equal(gt.gameDateTicks('January 1 of YR0'), 0);
  assert.equal(gt.gameDateTicks('February 20 of YR2'), 2 * 168 + 24 + 19);
  assert.equal(gt.formatGameDate(gt.fromTicks(gt.gameDateTicks('July 24 of YR8'))), 'July 24 of YR8');
  assert.equal(gt.parseGameDate('August 1 of YR1'), null);
});

test('tick zero from a Throne clock reading, and back to dates', () => {
  const start = dayStart('May 22 of YR9');
  const tz = gt.tickZeroFromClock(clockAt('May 22 of YR9', start, 32));
  assert.equal(tz, T0);
  assert.equal(gt.gameDateAt(start + 59 * 60000, tz), 'May 22 of YR9');
  assert.equal(gt.gameDateAt(start + 61 * 60000, tz), 'May 23 of YR9');
  // A reading taken a minute after the tick still lands on the same day start.
  assert.equal(gt.tickZeroFromClock(clockAt('May 22 of YR9', start, 1)), T0);
  assert.equal(gt.tickZeroFromClock({ game_date: 'nonsense', minutes_to_next_tick: 3, read_at: 'x' }), null);
});

// ── age detection ────────────────────────────────────────────────────────

function newAges(dir) {
  const ages = new AgeManager({ dataDir: dir, initialAge: 117 });
  ages.load();
  return ages;
}

test('age: first reading sets the timeline, matching readings are fine', () => {
  const ages = newAges(tmpDir());
  assert.equal(ages.observeClock(clockAt('March 3 of YR4', dayStart('March 3 of YR4'))).status, 'initialized');
  assert.equal(ages.tickZeroMs(), T0);
  assert.equal(ages.observeClock(clockAt('March 9 of YR4', dayStart('March 9 of YR4'), 55)).status, 'ok');
});

test('age: a single misread never changes anything', () => {
  const ages = newAges(tmpDir());
  const start = dayStart('March 3 of YR4');
  ages.observeClock(clockAt('March 3 of YR4', start));
  // Page misread as YR0 once, then normal readings again.
  assert.equal(ages.observeClock(clockAt('March 3 of YR0', start + H)).status, 'candidate');
  assert.equal(ages.observeClock(clockAt('March 5 of YR4', start + 2 * H)).status, 'ok');
  assert.equal(ages.observeClock(clockAt('March 3 of YR0', start + 3 * H)).status, 'candidate');
  assert.equal(ages.pending, null);
  assert.equal(ages.currentAge, 117);
  assert.equal(ages.tickZeroMs(), T0);
});

test('age: two agreeing readings an hour apart propose a new age; confirm switches', () => {
  const dir = tmpDir();
  const ages = newAges(dir);
  ages.observeClock(clockAt('July 20 of YR8', dayStart('July 20 of YR8')));
  // The new age starts 3 days later: its January 1 of YR0 begins at newT0.
  const newT0 = dayStart('July 20 of YR8') + 72 * H;
  let emitted = 0;
  ages.on('pending', () => emitted++);
  assert.equal(ages.observeClock(clockAt('January 2 of YR0', newT0 + H, 10)).status, 'candidate');
  // Same hour again is not enough...
  assert.equal(ages.observeClock(clockAt('January 2 of YR0', newT0 + H, 30)).status, 'candidate');
  // ...a reading 50+ minutes later is.
  assert.equal(ages.observeClock(clockAt('January 3 of YR0', newT0 + 2 * H, 15)).status, 'pending-new');
  assert.equal(emitted, 1);
  assert.equal(ages.pending.proposedAge, 118);
  assert.equal(ages.currentAge, 117, 'nothing switches before confirmation');
  assert.match(ages.describePending(), /age 118/);

  assert.equal(ages.confirmAgeChange(), 118);
  assert.equal(ages.tickZeroMs(), newT0);
  assert.equal(ages.ownKingdom, null);
  assert.ok(fs.existsSync(path.join(dir, 'ages', '118', 'wars')));
  // State survives a restart.
  const again = newAges(dir);
  assert.equal(again.currentAge, 118);
});

test('age: a rejected age change is not proposed again', () => {
  const ages = newAges(tmpDir());
  ages.observeClock(clockAt('July 20 of YR8', dayStart('July 20 of YR8')));
  const newT0 = dayStart('July 20 of YR8') + 72 * H;
  ages.observeClock(clockAt('January 2 of YR0', newT0 + H));
  ages.observeClock(clockAt('January 3 of YR0', newT0 + 2 * H));
  ages.rejectAgeChange();
  assert.equal(ages.observeClock(clockAt('January 4 of YR0', newT0 + 3 * H)).status, 'rejected');
  assert.equal(ages.pending, null);
});

test('age: small agreeing shifts are adopted as drift, not a new age', () => {
  const ages = newAges(tmpDir());
  ages.observeClock(clockAt('March 3 of YR4', dayStart('March 3 of YR4')));
  // The game skipped 5 ticks: dates now run 5 days behind.
  const shift = 5 * H;
  ages.observeClock(clockAt('March 10 of YR4', dayStart('March 10 of YR4') + shift));
  const r = ages.observeClock(clockAt('March 11 of YR4', dayStart('March 11 of YR4') + shift));
  assert.equal(r.status, 'drift-adopted');
  assert.equal(ages.tickZeroMs(), T0 + shift);
  assert.equal(ages.currentAge, 117);
});

test('age: old ages are offered for cleanup, and can be snoozed until next age', () => {
  const dir = tmpDir();
  const ages = newAges(dir);
  for (const a of [113, 114, 115, 116, 117]) fs.mkdirSync(path.join(dir, 'ages', String(a), 'wars'), { recursive: true });
  assert.deepEqual(ages.oldAges(), [113, 114]);
  assert.equal(ages.needsCleanupPrompt(), true);
  ages.snoozeCleanup();
  assert.equal(ages.needsCleanupPrompt(), false);
  ages.state.currentAge = 118; // next age: ask again
  assert.equal(ages.needsCleanupPrompt(), true);
  assert.deepEqual(ages.deleteOldAges(), [113, 114, 115]);
  assert.ok(!fs.existsSync(path.join(dir, 'ages', '113')));
  assert.ok(fs.existsSync(path.join(dir, 'ages', '116')));
});

// ── event log ────────────────────────────────────────────────────────────

test('event log: dedupes by message id, reads ranges, prunes old days', () => {
  const dir = tmpDir();
  const log = new EventLog({ dataDir: dir, retentionDays: 14 });
  log.load();
  const ev = { province: 'Joker', timestamp: '2026-11-05T10:15:00.000Z' };
  assert.equal(log.append('espionage', '111', 0, ev), true);
  assert.equal(log.append('espionage', '111', 0, ev), false);
  assert.equal(log.append('espionage', '111', 1, ev), true);
  log.append('attack', '99', 0, { attacker: 'Joker', timestamp: '2026-10-01T10:00:00.000Z' });
  // A fresh instance (bot restart) still knows what's logged.
  const again = new EventLog({ dataDir: dir });
  again.load();
  assert.equal(again.append('espionage', '111', 0, ev), false);
  const got = again.inRange(Date.parse('2026-11-05T10:00:00Z'), Date.parse('2026-11-05T11:00:00Z'));
  assert.equal(got.length, 2);
  assert.equal(got[0].discordTime, ev.timestamp);
  assert.equal(got[0].timestamp, undefined);
  assert.equal(again.prune(Date.parse('2026-11-07T00:00:00Z')), 1);
  assert.equal(fs.readdirSync(path.join(dir, 'events')).filter((f) => f.endsWith('.jsonl')).length, 1);
});

// ── parsers ──────────────────────────────────────────────────────────────

test('self-spells parse success and failure', () => {
  const msg = ':star2::broken_heart: underworld underworl#  <<__patriotism__>> __FAIL__ (-3 wizards) | 9.6% guilds (103% BE (m.9.9))\n'
    + ':star2::green_heart: underworld underworl#  <<__patriotism__>> **9** | 9.6% guilds (103% BE (m.9.9))';
  const [fail, ok] = parseSelfSpellMessage(msg, '2026-11-08T01:11:54.227Z');
  assert.deepEqual(
    { province: fail.province, spell: fail.spell, success: fail.success, lostWizards: fail.lostWizards },
    { province: 'underworld', spell: 'patriotism', success: false, lostWizards: 3 });
  assert.equal(ok.success, true);
  assert.equal(ok.value, 9);
});

test('news attacks: shapes, unknown attackers, conquest', () => {
  const a = parseNewsAttack('6 - Trailblazer SS (5:7) captured 81 acres of land from 9 - Hagars Horrible Sidekick (4:12).');
  assert.equal(a.type, 'capture');
  assert.equal(a.acres, 81);
  assert.deepEqual(a.attacker, { number: 6, name: 'Trailblazer SS', kd: '5:7' });
  assert.equal(a.defender.name, 'Hagars Horrible Sidekick');

  const inv = parseNewsAttack('18 - Goldhaven (4:12) invaded 10 - Renault 5 GT Turbo (5:7) and killed 2,038 people.');
  assert.equal(inv.type, 'massacre');
  assert.equal(inv.people, 2038);
  assert.equal(inv.defender.name, 'Renault 5 GT Turbo');

  const unk = parseNewsAttack('An unknown province from We have a fast car (5:7) captured 82 acres of land from 9 - Hagars Horrible Sidekick (4:12).');
  assert.equal(unk.attacker.unknown, true);
  assert.equal(unk.attacker.kd, '5:7');
  assert.equal(unk.defender.name, 'Hagars Horrible Sidekick');

  assert.equal(parseNewsAttack('16 - 1985 Chevy Citation (5:7), captured 9 acres of land from 9 - Hagars Horrible Sidekick (4:12).').type, 'conquest');
  assert.equal(parseNewsAttack('12 - El Camino (5:7) recaptured 100 acres of land from 19 - Oops (4:12).').type, 'ambush');
  assert.equal(parseNewsAttack('19 - Oops (4:12) attempted to invade 12 - El Camino (5:7).').type, 'bounce');
  assert.equal(parseNewsAttack('Unnamed kingdom (4:12) has declared WAR with our kingdom!'), null);
});

test('news parser handles every attack in the real war log', () => {
  const file = path.join(__dirname, 'fixtures', 'war_news_live.txt');
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  const attacks = lines.map((l) => parseNewsAttack(l.split('\t')[1])).filter(Boolean);
  assert.equal(attacks.length, 399);
  assert.equal(detectOwnKingdom(attacks, '4:12'), '5:7');
});

// ── war store + summary, end to end ─────────────────────────────────────

const OWN = '1:5';
const OPP = '6:7';

function warPayload({ ended, clock, extraItems = [] }) {
  const items = [
    { date: 'February 20 of YR2', text: `Big Bad (${OPP}) has declared WAR with our kingdom!` },
    { date: 'February 20 of YR2', text: `3 - Jurassic Park (${OWN}) captured 97 acres of land from 4 - Lich and subscribe (${OPP}).` },
    { date: 'February 21 of YR2', text: `7 - Plague Doctor (${OPP}) invaded 5 - The 5th Element (${OWN}) and captured 40 acres of land.` },
    { date: 'February 21 of YR2', text: `3 - Jurassic Park (${OWN}) recaptured 12 acres of land from 7 - Plague Doctor (${OPP}).` },
    ...extraItems,
  ];
  if (ended) items.push({ date: 'February 23 of YR2', text: 'Our kingdom is now in a post-war period which will expire on March 10 of YR2.' });
  return {
    schema: 1, opponent: OPP, start_date: 'February 20 of YR2',
    end_date: ended ? 'February 23 of YR2' : null, ended,
    captured_at: clock.read_at, clock, items,
  };
}

function writeInbox(dir, payload) {
  const inbox = path.join(dir, 'inbox');
  fs.mkdirSync(inbox, { recursive: true });
  fs.writeFileSync(path.join(inbox, 'clock.json'), JSON.stringify(payload.clock));
  fs.writeFileSync(path.join(inbox, 'war-6-7.json'), JSON.stringify(payload));
}

function seedDiscord(log) {
  const at = (date, minutes) => new Date(dayStart(date) + minutes * 60000).toISOString();
  // Our hit on Feb 20, and the recapture on Feb 21, as #attacks shows them.
  const hit = parseAttackMessage(`:crossed_swords: Jurassic Park [**jurassic par#**] attacked __Lich and subscribe__ (${OPP})|captured: **97**|loss: **109 Drows**|kills: **146 (+20 prisoners)**|return: 8.12|84 spec creds|23313off (1 gens)`, at('February 20 of YR2', 12));
  const recap = parseAttackMessage(`:crossed_swords: Jurassic Park [**jurassic par#**] attacked __Plague Doctor__ (${OPP})|recaptured: **12**|loss: **10 Drows**|kills: **5**|return: 8.12|23313off (1 gens)`, at('February 21 of YR2', 40));
  hit.forEach((e, i) => log.append('attack', 'm1', i, e));
  recap.forEach((e, i) => log.append('attack', 'm2', i, e));
  const ops = parseEspionageMessage([
    `:detective::green_heart: Jurassic Park jurassic par#  <<__night strike__ **| Lich and subscribe (${OPP})**>> **28**|1500 sent (2.4)|rNW 0.77`,
    `:detective::broken_heart: Jurassic Park jurassic par#  <<__night strike__ **| Lich and subscribe (${OPP})**>> __FAIL__ (-43 thieves)|1500 sent (2.4)|rNW 0.82`,
    `:comet::green_heart: Jurassic Park jurassic par#  <<__mystic vortex__ **| Sleepers (${OWN})**>>|14.6% guilds|rNW 0.82`,
    `:comet::green_heart: Jurassic Park jurassic par#  <<__fireball__ **| Someone Else (2:2)**>> **300**|14.6% guilds|rNW 0.82`,
  ].join('\n'), at('February 21 of YR2', 5));
  ops.forEach((e, i) => log.append('espionage', 'm3', i, e));
  const self = parseSelfSpellMessage(':star2::green_heart: Jurassic Park jurassic par#  <<__fertile lands__>> **16** | 11.3% guilds', at('February 21 of YR2', 6));
  self.forEach((e, i) => log.append('selfspell', 'm4', i, e));
  // Outside the war: a day before it started.
  const before = parseEspionageMessage(`:detective::green_heart: Jurassic Park jurassic par#  <<__night strike__ **| Lich and subscribe (${OPP})**>> **30**|1500 sent`, at('February 19 of YR2', 5));
  before.forEach((e, i) => log.append('espionage', 'm0', i, e));
}

function setup() {
  const dir = tmpDir();
  const ages = newAges(dir);
  const eventLog = new EventLog({ dataDir: dir });
  eventLog.load();
  const store = new WarStore({ dataDir: dir, ages, eventLog, log: quiet });
  seedDiscord(eventLog);
  return { dir, ages, eventLog, store };
}

test('war store: ingests inbox news, keeps first-seen times, copies events in the window', () => {
  const { dir, ages, store } = setup();
  const c1 = clockAt('February 21 of YR2', dayStart('February 21 of YR2'), 50);
  writeInbox(dir, warPayload({ ended: false, clock: c1 }));
  const now1 = Date.parse(c1.read_at);
  const r = store.processInbox(now1);
  assert.deepEqual(r.map((x) => x.status), ['initialized', 'ingested']);
  assert.equal(ages.ownKingdom, OWN);

  let [war] = store.findWars(OPP);
  assert.equal(war.age, 117);
  assert.equal(war.ended, false);
  assert.equal(war.news[1].firstSeen, c1.read_at);
  assert.equal(war.news[1].realStart, new Date(dayStart('February 20 of YR2')).toISOString());
  // In-war events only (not the Feb 19 op), and each carries its game date.
  assert.equal(war.events.length, 2 + 4 + 1);
  assert.ok(war.events.every((e) => e.gameDate && e.seenAt && e.discordTime));
  assert.ok(!war.events.some((e) => e.messageId === 'm0'));

  // Next cycle: the war has ended. Old items keep their first-seen time.
  const c2 = clockAt('February 23 of YR2', dayStart('February 23 of YR2'), 30);
  writeInbox(dir, warPayload({ ended: true, clock: c2 }));
  store.processInbox(Date.parse(c2.read_at));
  [war] = store.findWars(OPP);
  assert.equal(war.ended, true);
  assert.equal(war.news[1].firstSeen, c1.read_at);
  assert.equal(war.news.at(-1).firstSeen, c2.read_at);
  assert.equal(war.closed, false);
  assert.equal(fs.readdirSync(path.join(dir, 'inbox')).filter((f) => f.endsWith('.json')).length, 0);

  // Six hours after the war's last day it closes; later events are not added.
  store.syncOpenWars(dayStart('February 23 of YR2') + H + 7 * H);
  [war] = store.findWars(OPP);
  assert.equal(war.closed, true);
});

test('war store: war news for an unconfirmed new age waits in the inbox', () => {
  const { dir, ages, store } = setup();
  ages.observeClock(clockAt('July 20 of YR8', dayStart('July 20 of YR8')));
  const newT0 = dayStart('July 20 of YR8') + 72 * H;
  ages.observeClock(clockAt('January 2 of YR0', newT0 + H));
  ages.observeClock(clockAt('January 3 of YR0', newT0 + 2 * H));
  assert.ok(ages.pending);
  const payload = warPayload({ ended: false, clock: clockAt('January 3 of YR0', newT0 + 2 * H, 40) });
  writeInbox(dir, payload);
  const r = store.processInbox(newT0 + 3 * H);
  assert.equal(r.find((x) => x.file === 'war-6-7.json').status, 'waiting-for-age-confirmation');
  assert.ok(fs.existsSync(path.join(dir, 'inbox', 'war-6-7.json')));
  ages.confirmAgeChange();
  store.processInbox(newT0 + 3 * H);
  assert.equal(store.listWars(118).length, 1);
  assert.equal(store.listWars(117).length, 0);
});

test('summary: matches #attacks to news, sorts ops, hides self-spells by default', () => {
  const { dir, store } = setup();
  const c = clockAt('February 23 of YR2', dayStart('February 23 of YR2'), 30);
  writeInbox(dir, warPayload({ ended: true, clock: c }));
  store.processInbox(Date.parse(c.read_at));
  const [war] = store.findWars(OPP);

  const s = summarize([war], { knownProvinces: getProvinces() });
  const jp = s.provinces.get('jurassic park');
  assert.equal(jp.made.count, 2);
  assert.equal(jp.made.acres, 97 + 12);
  assert.equal(jp.discord.matched, 2);
  assert.equal(jp.discord.unmatched, 0);
  assert.equal(jp.discord.kills, 146 + 5);
  assert.equal(jp.discord.troopLosses, 109 + 10);
  assert.equal(jp.discord.specCredits, 84);
  const ns = jp.ops.vsOpponent.get('night strike');
  assert.deepEqual([ns.count, ns.success, ns.fail, ns.total], [2, 1, 1, 28]);
  assert.equal(jp.ops.thievesLost, 43);
  assert.deepEqual(jp.ops.vortexOwn, { count: 1, success: 1 });
  assert.equal(jp.ops.other, 1);
  assert.equal(jp.selfSpells.size, 0);

  const fifth = s.provinces.get('the 5th element');
  assert.equal(fifth.taken.count, 1);
  assert.equal(fifth.taken.acres, 40);
  assert.equal(s.kingdom.acresGained, 109);
  assert.equal(s.kingdom.acresLost, 40);

  const withSelf = summarize([war], { includeSelfSpells: true });
  assert.equal(withSelf.provinces.get('jurassic park').selfSpells.get('fertile lands').count, 1);

  const text = formatWarReport({ war, window: store.window(war), summary: s, age: 117 });
  assert.match(text, /WAR vs 6:7 — Feb 20 YR2 – Feb 23 YR2 — Age 117/);
  assert.match(text, /Jurassic Park\s+2\s+109/);
  assert.match(text, /Ops Success Intel/);
  // Jurassic Park's 2 night strikes on the enemy: 1 ok (50%); no intel ops.
  assert.match(text, /Jurassic Park\s+2\s+109\s+0\s+0\s+2\s+50%\s+0\n/);
  const detail = formatWarReport({ war, window: store.window(war), summary: s, age: 117, province: 'jurassic' });
  assert.match(detail, /From #attacks \(2 of 2 hits\): kills 151 \(\+20 prisoners\)/);
  assert.match(detail, /Mystic Vortex on kingdom-mates: 1/);
  assert.doesNotMatch(detail, /SELF-SPELLS/);

  const ageText = formatAgeReport({ age: 117, wars: [war], windows: [store.window(war)], perWar: [s], summary: s });
  assert.match(ageText, /^AGE 117 — Feb 20 YR2 – Feb 23 YR2 — 1 war\(s\)\n/);
  assert.match(ageText, /UTC \(3h at war\)/); // Feb 20–22: the war ends at the tick starting Feb 23
  assert.match(ageText, /Ops on enemies: \d+ \(\d+% success\)/);
  assert.match(ageText, /WARS\n  vs 6:7 .* hits    2 made    1 taken  net \+69/);
  assert.ok(ageText.indexOf('Hits made:') < ageText.indexOf('WARS'), 'totals first, like the war report');
  assert.ok(ageText.indexOf('WARS') < ageText.indexOf('Province '), 'then the wars, then the table');
  const past = formatAgeReport({ age: 116, wars: [war], windows: [store.window(war)], perWar: [s], summary: s, current: false });
  assert.match(past, /^AGE 116 .* \(past age\)/);
});

// ── fixes found on real data (2026-11-08) ───────────────────────────────

test('parsers accept two spaces after the emoji', () => {
  const op = parseEspionageMessage(':detective::green_heart:  Jurassic Park JP CAPS <<__rob the granaries__ **| Yellow (2:10)**>> **4331**|60 sent', 't');
  assert.equal(op.length, 1);
  assert.equal(op[0].province, 'Jurassic Park');
  assert.equal(op[0].impactValue, 4331);
  const self = parseSelfSpellMessage(':star2::green_heart:  Sleepers SLEEPERS <<__minor protection__>> **13** | 12.6% guilds', 't');
  assert.equal(self.length, 1);
  assert.equal(self[0].spell, 'minor protection');
});

test('event ids follow the message line, so recognizing more lines adds no duplicates', () => {
  const dir = tmpDir();
  const log = new EventLog({ dataDir: dir });
  log.load();
  const msg = [
    ':detective::green_heart: Newcomer newcome#  <<__spy on throne__ **| Foe (6:7)**>>|10 sent',
    ':detective::green_heart: Jurassic Park jurassic par#  <<__night strike__ **| Foe (6:7)**>> **28**|1500 sent',
  ].join('\n');
  const t = '2026-11-05T10:00:00.000Z';
  const first = parseEspionageMessage(msg, t);
  assert.equal(first.length, 1);
  first.forEach((e, i) => log.append('espionage', 'm9', i, e));
  getProvinces().push('Newcomer');
  try {
    const second = parseEspionageMessage(msg, t);
    assert.equal(second.length, 2);
    const added = second.filter((e, i) => log.append('espionage', 'm9', i, e));
    assert.deepEqual(added.map((e) => e.province), ['Newcomer']);
  } finally {
    getProvinces().splice(getProvinces().indexOf('Newcomer'), 1);
  }
  assert.equal(log.inRange(0, Date.parse('2027-01-01')).length, 2);
});

test('event log in an old id format is cleared at load, to be re-read from Discord', () => {
  const dir = tmpDir();
  fs.mkdirSync(path.join(dir, 'events'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'events', '2026-11-05.jsonl'),
    JSON.stringify({ id: 'espionage:m1:0', discordTime: '2026-11-05T10:00:00.000Z' }) + '\n');
  const log = new EventLog({ dataDir: dir });
  assert.equal(log.load(), 0);
  assert.equal(log.rebuilt, true);
  const again = new EventLog({ dataDir: dir });
  again.load();
  assert.equal(again.rebuilt, false);
});

test('rebuild refreshes a closed war from the log, keeping kinds the log lacks', () => {
  const { dir, store, eventLog } = setup();
  const c = clockAt('February 23 of YR2', dayStart('February 23 of YR2'), 30);
  writeInbox(dir, warPayload({ ended: true, clock: c }));
  const later = dayStart('February 23 of YR2') + 12 * H;
  store.processInbox(later);
  let [war] = store.findWars(OPP);
  assert.equal(war.closed, true);
  const opsBefore = war.events.filter((e) => e.kind === 'espionage').length;

  // A line the parser used to miss turns up in the log after the war closed.
  const extra = parseEspionageMessage(`:comet::green_heart:  The 5th Element THE 5TH <<__fireball__ **| Plague Doctor (${OPP})**>> **200**|x`,
    new Date(dayStart('February 22 of YR2') + 5 * 60000).toISOString());
  extra.forEach((e, i) => eventLog.append('espionage', 'm7', i, e));
  // And the log has no self-spells at all (say the channel was renamed).
  war.events.push({ id: 'selfspell:old:L0', kind: 'selfspell', discordTime: new Date(dayStart('February 21 of YR2')).toISOString() });
  fs.writeFileSync(store.warFile(117, war.key), JSON.stringify(war));
  fs.rmSync(path.join(dir, 'events', `${new Date(dayStart('February 21 of YR2')).toISOString().slice(0, 10)}.jsonl`), { force: true });
  eventLog.load();
  extra.forEach((e, i) => eventLog.append('espionage', 'm7', i, e));
  seedDiscord(eventLog);
  // Seeding re-adds the self-spell too; drop it again to test the fallback.
  const selfFile = fs.readdirSync(path.join(dir, 'events')).find((f) => f.endsWith('.jsonl') && fs.readFileSync(path.join(dir, 'events', f), 'utf8').includes('"selfspell"'));
  const kept = fs.readFileSync(path.join(dir, 'events', selfFile), 'utf8').split('\n').filter((l) => !l.includes('"selfspell"')).join('\n');
  fs.writeFileSync(path.join(dir, 'events', selfFile), kept);

  const r = store.rebuildAll(later);
  assert.equal(r.length, 1);
  [war] = store.findWars(OPP);
  assert.equal(war.closed, true);
  assert.equal(war.events.filter((e) => e.kind === 'espionage').length, opsBefore + 1);
  assert.ok(war.events.some((e) => e.id === 'selfspell:old:L0'), 'kept: the log had no self-spells');
  assert.equal(new Set(war.events.map((e) => e.id)).size, war.events.length, 'no duplicates');

  // Once the war is older than the log's coverage, it is left alone.
  assert.equal(store.rebuildAll(later + 40 * 24 * H).length, 0);
});

test('summary credits an unknown-province hit to the province #attacks names', () => {
  const { dir, store, eventLog } = setup();
  const c = clockAt('February 23 of YR2', dayStart('February 23 of YR2'), 30);
  writeInbox(dir, warPayload({
    ended: true,
    clock: c,
    extraItems: [{ date: 'February 22 of YR2', text: `An unknown province from Movie Knight (${OWN}) captured 18 acres of land from 3 - Grave New World (${OPP}).` }],
  }));
  parseAttackMessage(`:crossed_swords: underworld [**underworl#**] attacked __Grave New World__ (${OPP})|captured: **18**|loss: **5 Drows**|kills: **3**|return: 9`,
    new Date(dayStart('February 22 of YR2') + 11 * 60000).toISOString())
    .forEach((e, i) => eventLog.append('attack', 'm8', i, e));
  store.processInbox(Date.parse(c.read_at));
  const [war] = store.findWars(OPP);
  const s = summarize([war], { knownProvinces: getProvinces() });
  const uw = s.provinces.get('underworld');
  assert.equal(uw.made.count, 1);
  assert.equal(uw.made.acres, 18);
  assert.equal(uw.discord.matched, 1);
  assert.equal(s.kingdom.unknownMade, 0);
  assert.equal(s.kingdom.made, 3);
});

test('latestWar: the running war, else the most recent, else the previous age', () => {
  const dir = tmpDir();
  const ages = newAges(dir);
  const store = new WarStore({ dataDir: dir, ages, log: quiet });
  const put = (age, key, startDate, ended) => {
    const file = path.join(dir, 'ages', String(age), 'wars', `${key}.json`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ key, age, opponent: key, startDate, ended, news: [], events: [] }));
  };
  assert.equal(store.latestWar(), null);
  put(116, 'old', 'March 1 of YR5', true);
  assert.equal(store.latestWar().key, 'old', 'no wars yet this age: last war of the previous age');
  put(117, 'first', 'June 5 of YR0', true);
  put(117, 'second', 'February 20 of YR2', true);
  assert.equal(store.latestWar().key, 'second', 'not at war: the most recent war');
  put(117, 'now', 'May 9 of YR2', false);
  assert.equal(store.latestWar().key, 'now', 'at war: the running war');
  assert.equal(store.latestWar().age, 117);
});

test('listAges: age folders newest first', () => {
  const dir = tmpDir();
  const store = new WarStore({ dataDir: dir, ages: newAges(dir), log: quiet });
  assert.deepEqual(store.listAges(), []);
  for (const a of [115, 117, 116]) fs.mkdirSync(path.join(dir, 'ages', String(a)), { recursive: true });
  fs.mkdirSync(path.join(dir, 'ages', 'notes'));
  assert.deepEqual(store.listAges(), [117, 116, 115]);
});

test('province table: most hits, then most acres, then most ops', () => {
  const row = (name, hits, acres, ops) => {
    const p = {
      name,
      made: { count: hits, acres, byType: {} },
      taken: { count: 0, acres: 0, byType: {} },
      ops: { vsOpponent: new Map() },
    };
    if (ops) p.ops.vsOpponent.set('fireball', { meta: { category: 'spell' }, count: ops, success: ops });
    return [name.toLowerCase(), p];
  };
  const summary = {
    kingdom: { made: 0, acresGained: 0, taken: 0, acresLost: 0, unknownMade: 0, vortexOwn: 0,
      ops: { count: 0, success: 0, thievery: 0, spells: 0, intel: 0 } },
    provinces: new Map([
      row('Few Hits Big Land', 2, 900, 0),
      row('Tie Fewer Ops', 5, 300, 10),
      row('Tie More Ops', 5, 300, 40),
      row('Most Hits', 9, 100, 0),
      row('Same Hits More Acres', 5, 400, 0),
    ]),
  };
  const war = { opponent: '6:7', startDate: 'February 20 of YR2', endDate: 'February 23 of YR2', ended: true };
  const text = formatWarReport({ war, window: { start: null, end: null }, summary, age: 117 });
  const order = text.split('\n').filter((l) => /^(Few|Tie|Most|Same)/.test(l)).map((l) => l.slice(0, 20).trim());
  assert.deepEqual(order, ['Most Hits', 'Same Hits More Acres', 'Tie More Ops', 'Tie Fewer Ops', 'Few Hits Big Land']);
});

// ── /tm-stats source selection ──────────────────────────────────────────

const { selectOps } = require('../src/commands/tmStats');

test('/tm-stats: current/last war by default, a named war, or a period', () => {
  const dir = tmpDir();
  const ages = newAges(dir);
  const store = new WarStore({ dataDir: dir, ages, log: quiet });
  const recentCalls = [];
  const deps = {
    warStore: store,
    refresh: () => {},
    currentAge: () => 117,
    recent: (hours) => { recentCalls.push(hours); return [{ province: 'Joker', from: 'memory' }]; },
  };
  const op = (id, target, t) => ({ id, kind: 'espionage', province: 'Joker', missionType: 'fireball', opIcon: 'comet', target, success: true, lostCount: 0, impactValue: 1, discordTime: t });
  const put = (key, opponent, startDate, ended, events) => {
    const file = path.join(dir, 'ages', '117', 'wars', `${key}.json`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ key, age: 117, opponent, startDate, endDate: ended ? 'April 21 of YR2' : null, ended, news: [], events }));
  };

  // No war recorded yet: everything in memory.
  let r = selectOps({}, deps);
  assert.match(r.label, /no war recorded/);
  assert.deepEqual(recentCalls, [null]);

  put('a', '5:12', 'June 5 of YR0', true, [op('e1', 'Fortnite (5:12)', '2026-10-26T00:00:00Z')]);
  put('b', '6:7', 'February 20 of YR2', true, [
    op('e2', 'Plague Doctor (6:7)', '2026-11-06T00:00:00Z'),
    op('e3', 'Lich (6:7)', '2026-11-06T01:00:00Z'),
    { id: 's1', kind: 'selfspell', province: 'Joker', spell: 'patriotism', discordTime: '2026-11-06T00:00:00Z' },
  ]);

  r = selectOps({}, deps);
  assert.equal(r.ops.length, 2, 'the last war, tm-ops only');
  assert.equal(r.ops[0].timestamp, '2026-11-06T00:00:00Z');
  assert.match(r.label, /war vs 6:7 \(Feb 20 YR2 – Apr 21 YR2\)$/);

  r = selectOps({ war: '5:12' }, deps);
  assert.equal(r.ops.length, 1);
  assert.match(r.label, /war vs 5:12/);

  put('c', '2:3', 'May 9 of YR2', false, [op('e4', 'X (2:3)', '2026-11-08T03:00:00Z')]);
  r = selectOps({}, deps);
  assert.match(r.label, /war vs 2:3 \(May 9 YR2 – ongoing, so far\)/, 'at war: the running war');

  r = selectOps({ period: 6 }, deps);
  assert.equal(r.ops[0].from, 'memory');
  assert.equal(r.label, ' (last 6h)');

  assert.match(selectOps({ war: '9:9' }, deps).error, /No war vs 9:9/);
  assert.match(selectOps({ war: '69' }, deps).error, /isn't a kingdom location/);
  assert.match(selectOps({ war: '6:7', period: 6 }, deps).error, /not both/);
});

// ── Thief & Mage forum report ───────────────────────────────────────────

const { buildTmReport, opName } = require('../src/war/tmReport');

test('TM report: op names read like the game', () => {
  assert.equal(opName('rob the towers'), 'Rob the Towers');
  assert.equal(opName('spy on throne'), 'Spy on Throne');
  assert.equal(opName('propaganda: specialist'), 'Propaganda (Specialist)');
  assert.equal(opName('fireball'), 'Fireball');
});

test('TM report: three top lists and the full report, enemy ops only', () => {
  const t = '2026-11-06T00:00:00Z';
  let n = 0;
  const op = (province, missionType, opIcon, success, impactValue = 0, target = 'Foe (6:7)', lost = null) => ({
    id: `e${n++}`, kind: 'espionage', province, missionType, opIcon, success, impactValue, target, discordTime: t,
    lostCount: lost ? lost[0] : 0, lostUnit: lost ? lost[1] : null,
  });
  const events = [
    ...Array.from({ length: 3 }, () => op('Thief A', 'rob the vaults', 'detective', true, 1000)),
    op('Thief A', 'rob the vaults', 'detective', false, 0, 'Foe (6:7)', [7, 'thieves']),
    op('Thief A', 'kidnap', 'detective', true, 50),
    ...Array.from({ length: 2 }, () => op('Thief B', 'night strike', 'detective', true, 20)),
    ...Array.from({ length: 2 }, () => op('Mage C', 'meteor showers', 'comet', true, 8)),
    op('Mage C', 'fireball', 'comet', true, 300),
    op('Mage C', 'fireball', 'comet', false, 0, 'Foe (6:7)', [3, 'wizards']),
    ...Array.from({ length: 4 }, () => op('Spy D', 'spy on throne', 'detective', true)),
    op('Spy D', 'survey', 'detective', true),
    op('Mage C', 'mystic vortex', 'comet', true, 0, 'Friend (1:5)'),
    op('Thief A', 'rob the vaults', 'detective', true, 99999, 'Bystander (2:2)'),  // not the enemy
    { id: 'self', kind: 'selfspell', province: 'Mage C', spell: 'patriotism', success: true, discordTime: t },
  ];
  const war = { opponent: '6:7', ownKingdom: '1:5', startDate: 'February 20 of YR2', endDate: 'April 21 of YR2', ended: true, events };
  const text = buildTmReport(war);
  const lines = text.split('\n');
  assert.equal(lines[0], 'Thief & Mage Report — War vs 6:7 (Feb 20 YR2 – Apr 21 YR2)');
  assert.equal(lines[1], 'Full war.');
  assert.equal(lines[2], 'Successful ops on 6:7: 6 thievery, 3 spells, 5 intel');
  assert.match(text, /TOP THIEVES — successful thievery ops on 6:7\n4 \| Thief A — Rob the Vaults x3: 3,000 gc stolen\n2 \| Thief B — Night Strike x2: 40 troops killed/);
  assert.match(text, /TOP MAGES — successful spells on 6:7\n3 \| Mage C — Meteor Showers x2: 16 days/);
  assert.match(text, /TOP INTEL GATHERERS — successful intel ops on 6:7\n5 \| Spy D — Spy on Throne x4, Survey x1/);
  assert.doesNotMatch(text, /99,999/, 'ops on other kingdoms are left out');
  assert.match(text, /1\. Thief A — 4 successful \(4 thievery, 0 spells\)\n   Lost 7 thieves\n   Thievery\n     3\/4 Rob the Vaults: 3,000 gc stolen\n     1\/1 Kidnap: 50 peasants kidnapped/);
  assert.match(text, /2\. Mage C — 3 successful \(0 thievery, 3 spells\)\n   Lost 3 wizards\n   Spells\n     2\/2 Meteor Showers: 16 days\n     1\/2 Fireball: 300 peasants killed\n   Mystic Vortex on kingdom-mates: 1 \(1 successful\)/);
  assert.doesNotMatch(text, /Spy D — \d+ successful/, 'intel-only provinces are not in the full report');
  assert.match(buildTmReport({ ...war, ended: false, endDate: null }), /^.*\(Feb 20 YR2 – ongoing\)\nWar so far\.\.\./);
});

test('TM report file is written next to the war and kept out of the war list', () => {
  const { dir, store } = setup();
  const c = clockAt('February 23 of YR2', dayStart('February 23 of YR2'), 30);
  writeInbox(dir, warPayload({ ended: true, clock: c }));
  store.processInbox(Date.parse(c.read_at));
  const [war] = store.findWars(OPP);
  const file = path.join(dir, 'ages', '117', 'wars', `${war.key}.tm-report.json`);
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(report.opponent, OPP);
  assert.equal(report.startDate, 'February 20 of YR2');
  assert.equal(report.ended, true);
  assert.match(report.text, /^Thief & Mage Report — War vs 6:7/);
  assert.equal(store.listWars().length, 1);
  assert.equal(store.saveAllTmReports(), 1);
});

// ── aid and dragons in the war records ──────────────────────────────────

const { parseAidMessage } = require('../src/parsers/aidParser');
const { parseDragonLines } = require('../src/handlers/dragonParser');
const { summarizeAid, summarizeDragons } = require('../src/war/warSummary');

test('aid and dragon lines parse with line numbers', () => {
  const aid = parseAidMessage(':moneybag: Joker [jok#] sent __300,000 gold coins__ to Olko [olko]\n'
    + ':moneybag: Joker [jok#] sent __50,000 bushels__ to Sleepers [sleepers]', 't');
  assert.deepEqual(aid.map((e) => [e.sender, e.receiver, e.resource, e.amount, e.line]),
    [['Joker', 'Olko', 'gold', 300000, 0], ['Joker', 'Sleepers', 'bushels', 50000, 1]]);
  const dragons = parseDragonLines(':dragon_face: __DRAGON__ Olko [olk#] donated __75,000 gold coins__ to fund dragon!\n'
    + ':dragon_face: __DRAGON__ Joker [jok#] sent __1,200__ troops and weakened dragon by __9,876__ points!', 't');
  assert.deepEqual(dragons.map((e) => [e.type, e.province, e.goldDonated, e.troopsSent, e.pointsWeakened, e.line]),
    [['donation', 'Olko', 75000, 0, 0, 0], ['attack', 'Joker', 0, 1200, 9876, 1]]);
});

test('war records carry aid and dragon events in their window, summarized per province', () => {
  const { dir, store, eventLog } = setup();
  const at = (date, minutes) => new Date(dayStart(date) + minutes * 60000).toISOString();
  parseAidMessage(':moneybag: Joker [jok#] sent __300,000 gold coins__ to Olko [olko]\n'
    + ':moneybag: Olko [olk#] sent __2,000 soldiers__ to Joker [joker]', at('February 21 of YR2', 3))
    .forEach((e, i) => eventLog.append('aid', 'a1', i, e));
  parseAidMessage(':moneybag: Joker [jok#] sent __999 runes__ to Olko [olko]', at('February 19 of YR2', 3))
    .forEach((e, i) => eventLog.append('aid', 'a0', i, e));   // before the war
  parseDragonLines(':dragon_face: __DRAGON__ Olko [olk#] donated __75,000 gold coins__ to fund dragon!\n'
    + ':dragon_face: __DRAGON__ Olko [olk#] donated __20,000 bushels__ to fund dragon!\n'
    + ':dragon_face: __DRAGON__ Joker [jok#] sent __1,200__ troops and weakened dragon by __9,876__ points!',
  at('February 22 of YR2', 10)).forEach((e, i) => eventLog.append('dragon', 'd1', i, e));

  const c = clockAt('February 23 of YR2', dayStart('February 23 of YR2'), 30);
  writeInbox(dir, warPayload({ ended: true, clock: c }));
  store.processInbox(Date.parse(c.read_at));
  const [war] = store.findWars(OPP);
  assert.equal(war.events.filter((e) => e.kind === 'aid').length, 2, 'the pre-war shipment is left out');
  assert.equal(war.events.filter((e) => e.kind === 'dragon').length, 3);
  assert.ok(war.events.every((e) => e.gameDate));

  const aid = summarizeAid([war], { knownProvinces: ['Joker', 'Olko'] });
  assert.deepEqual(aid.provinces.get('joker').sent, { gold: 300000, bushels: 0, runes: 0, soldiers: 0 });
  assert.deepEqual(aid.provinces.get('joker').received, { gold: 0, bushels: 0, runes: 0, soldiers: 2000 });
  assert.equal(aid.provinces.get('olko').received.gold, 300000);
  assert.equal(aid.provinces.get('olko').shipmentsSent, 1);
  assert.deepEqual(aid.totals, { gold: 300000, bushels: 0, runes: 0, soldiers: 2000 });

  const dragons = summarizeDragons([war]);
  assert.deepEqual({ ...dragons.provinces.get('olko') }, { name: 'Olko', goldDonated: 75000, bushelsDonated: 20000, troopsSent: 0, pointsWeakened: 0 });
  assert.equal(dragons.provinces.get('joker').pointsWeakened, 9876);
  assert.deepEqual(dragons.totals, { goldDonated: 75000, bushelsDonated: 20000, troopsSent: 1200, pointsWeakened: 9876 });

  // The TM report ignores them.
  assert.match(JSON.parse(fs.readFileSync(store.tmReportFile(117, war.key), 'utf8')).text, /^Thief & Mage Report/);
});

test('a war ends at the tick that starts the post-war notice day', () => {
  const { dir, store, eventLog } = setup();
  const c = clockAt('February 23 of YR2', dayStart('February 23 of YR2'), 30);
  // A dragon killed on the notice's day is after the war.
  parseDragonLines(':dragon_face: __DRAGON__ Joker [jok#] sent __4,000__ troops and weakened dragon by __50,000__ points!',
    new Date(dayStart('February 23 of YR2') + 20 * 60000).toISOString())
    .forEach((e, i) => eventLog.append('dragon', 'late', i, e));
  writeInbox(dir, warPayload({ ended: true, clock: c }));
  store.processInbox(Date.parse(c.read_at));
  const [war] = store.findWars(OPP);
  assert.equal(store.window(war).end, dayStart('February 23 of YR2'));
  assert.ok(!war.events.some((e) => e.messageId === 'late'));
});

// ── /dragon-stats war:… ─────────────────────────────────────────────────

const { lookupWar } = require('../src/war/warLookup');
const { warSource } = require('../src/commands/dragon');
const { generateDragonReport, generateForumReport } = require('../src/reports/dragonReport');

test('a war takes dragon donations from up to 48h before it, and nothing else early', () => {
  const { dir, store, eventLog } = setup();
  const start = dayStart('February 20 of YR2');
  const at = (hoursBefore) => new Date(start - hoursBefore * H).toISOString();
  const dragon = (line, t, id) => parseDragonLines(line, t).forEach((e, i) => eventLog.append('dragon', id, i, e));
  dragon(':dragon_face: __DRAGON__ Olko [olk#] donated __10,000 gold coins__ to fund dragon!', at(47), 'd47');
  dragon(':dragon_face: __DRAGON__ Olko [olk#] donated __5,000 bushels__ to fund dragon!', at(1), 'd1');
  dragon(':dragon_face: __DRAGON__ Olko [olk#] donated __99,000 gold coins__ to fund dragon!', at(49), 'd49');
  dragon(':dragon_face: __DRAGON__ Joker [jok#] sent __500__ troops and weakened dragon by __4,000__ points!', at(2), 'a2');
  parseAidMessage(':moneybag: Joker [jok#] sent __1,000 runes__ to Olko [olko]', at(3))
    .forEach((e, i) => eventLog.append('aid', 'aid3', i, e));

  const c = clockAt('February 23 of YR2', dayStart('February 23 of YR2'), 30);
  writeInbox(dir, warPayload({ ended: true, clock: c }));
  store.processInbox(Date.parse(c.read_at));
  let [war] = store.findWars(OPP);
  const early = war.events.filter((e) => e.preWar);
  assert.deepEqual(early.map((e) => e.messageId).sort(), ['d1', 'd47']);
  assert.ok(!war.events.some((e) => ['d49', 'a2', 'aid3'].includes(e.messageId)));
  assert.deepEqual(summarizeDragons([war]).totals, { goldDonated: 10000, bushelsDonated: 5000, troopsSent: 0, pointsWeakened: 0 });

  // A rebuild gives the same set.
  store.rebuildAll(Date.parse(c.read_at));
  [war] = store.findWars(OPP);
  assert.deepEqual(war.events.filter((e) => e.preWar).map((e) => e.messageId).sort(), ['d1', 'd47']);

  // And the other summaries don't see them.
  const s = summarize([war]);
  assert.equal(s.kingdom.made, 2);
});

test('lookupWar: current, by kingdom, and errors', () => {
  const dir = tmpDir();
  const store = new WarStore({ dataDir: dir, ages: newAges(dir), log: quiet });
  const deps = { warStore: store, refresh: () => {}, currentAge: () => 117 };
  assert.match(lookupWar('current', deps).error, /No war recorded/);
  const put = (key, opponent, startDate, ended) => {
    const file = path.join(dir, 'ages', '117', 'wars', `${key}.json`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ key, age: 117, opponent, startDate, ended, news: [], events: [] }));
  };
  put('a', '5:12', 'June 5 of YR0', true);
  put('b', '6:7', 'February 20 of YR2', true);
  assert.equal(lookupWar('current', deps).war.key, 'b');
  assert.equal(lookupWar(' Current ', deps).war.key, 'b');
  assert.equal(lookupWar('5:12', deps).war.key, 'a');
  assert.match(lookupWar('9:9', deps).error, /No war vs 9:9 recorded in age 117/);
  assert.match(lookupWar('last', deps).error, /isn't a war/);
});

test('/dragon-stats war report: war totals in every format, titled with the war', () => {
  const war = {
    opponent: '6:7', startDate: 'February 20 of YR2', endDate: 'April 21 of YR2', ended: true,
    events: [
      { kind: 'dragon', type: 'donation', province: 'Olko', goldDonated: 75000, bushelsDonated: 0, troopsSent: 0, pointsWeakened: 0, preWar: true },
      { kind: 'dragon', type: 'attack', province: 'Joker', goldDonated: 0, bushelsDonated: 0, troopsSent: 1200, pointsWeakened: 9876 },
      { kind: 'aid', sender: 'Joker', receiver: 'Olko', resource: 'gold', amount: 5 },
    ],
  };
  const source = warSource(war);
  assert.equal(source.label, ' — war vs 6:7 (Feb 20 YR2 – Apr 21 YR2) incl. donations up to 48h before the war');
  const [donations, attacks] = generateDragonReport(null, source);
  assert.match(donations, /^\*\*Dragon Summary — war vs 6:7 \(Feb 20 YR2 – Apr 21 YR2\)/);
  assert.match(donations, /Olko\s+GC: 75,000\s+Bushels: 0/);
  assert.match(donations, /Total\s+GC: 75,000/);
  assert.match(attacks, /Joker\s+Points: 9,876\s+Troops: 1,200/);
  assert.match(generateForumReport(null, source)[0], /Dragon Summary — war vs 6:7/);
  assert.equal(warSource({ ...war, ended: false, endDate: null, events: [] }).label,
    ' — war vs 6:7 (Feb 20 YR2 – ongoing, so far)');
});

// ── Discord's 2,000-character limit ─────────────────────────────────────

const { splitForDiscord } = require('../src/commands/commandUtils');

test('splitForDiscord keeps every message under the limit with blocks intact', () => {
  const rows = Array.from({ length: 60 }, (_, i) => `Province ${String(i).padStart(2)}             GC: 1,000,000   Bushels: 50,000`);
  const code = `**Dragon Summary**\n\`\`\`\n${rows.join('\n')}\n\`\`\``;
  const pre = `\`\`\`\n<pre><b>Dragon Summary</b><br><br>${rows.join('<br>')}</pre>\n\`\`\``;
  for (const message of [code, pre]) {
    const parts = splitForDiscord([message]);
    assert.ok(parts.length > 1);
    for (const p of parts) {
      assert.ok(p.length <= 2000, `${p.length} chars`);
      assert.equal((p.match(/```/g) || []).length % 2, 0, 'code fences balanced');
      assert.equal((p.match(/<pre>/g) || []).length, (p.match(/<\/pre>/g) || []).length, '<pre> balanced');
    }
    for (const row of rows) assert.ok(parts.some((p) => p.includes(row)), 'no row lost');
  }
  assert.deepEqual(splitForDiscord(['short']), ['short']);
});

// ── /dragon-stats totals per age ────────────────────────────────────────

const { ensureDragonAge, dragonTotalsSince } = require('../src/war/dragonAge');

function fakeDragonStore(age) {
  return {
    age, started: null,
    getAge() { return this.age; },
    startAge(newAge, totals, archive) { this.age = newAge; this.started = { newAge, totals, archive }; },
  };
}

test('dragon totals restart from the event log at the age start', () => {
  const dir = tmpDir();
  const ages = newAges(dir);
  const ageStart = Date.now() - 5 * 24 * H;
  ages.state.tickZeroAt = new Date(ageStart).toISOString();
  const log = new EventLog({ dataDir: dir, retentionDays: 30 });
  log.load();
  const dragon = (line, t, id) => parseDragonLines(line, new Date(t).toISOString()).forEach((e, i) => log.append('dragon', id, i, e));
  dragon(':dragon_face: __DRAGON__ Old Car [old#] donated __500,000 gold coins__ to fund dragon!', ageStart - 2 * H, 'old');
  dragon(':dragon_face: __DRAGON__ Olko [olk#] donated __75,000 gold coins__ to fund dragon!', ageStart + 3 * H, 'n1');
  dragon(':dragon_face: __DRAGON__ Olko [olk#] donated __20,000 bushels__ to fund dragon!\n'
    + ':dragon_face: __DRAGON__ Joker [jok#] sent __1,200__ troops and weakened dragon by __9,876__ points!', ageStart + 30 * H, 'n2');

  const quietLog = { log() {}, warn() {} };
  const untagged = fakeDragonStore(null);
  assert.match(ensureDragonAge({ ages, eventLog: log, store: untagged, log: quietLog }), /started age 117/);
  assert.equal(untagged.started.archive, 'dragon-before-age-117.json');
  const byName = Object.fromEntries(untagged.started.totals.map((t) => [t.province, t]));
  assert.deepEqual(Object.keys(byName).sort(), ['Joker', 'Olko'], "last age's province is gone");
  assert.equal(byName.Olko.goldDonated, 75000);
  assert.equal(byName.Olko.bushelsDonated, 20000);
  assert.equal(byName.Joker.pointsWeakened, 9876);

  // Already on this age: nothing happens.
  assert.equal(ensureDragonAge({ ages, eventLog: log, store: untagged, log: quietLog }), null);

  // A later age change archives under the old age number.
  const tagged = fakeDragonStore(116);
  ensureDragonAge({ ages, eventLog: log, store: tagged, log: quietLog });
  assert.equal(tagged.started.archive, 'dragon-age-116.json');

  // No known age start yet: leave the totals alone.
  ages.state.tickZeroAt = null;
  assert.equal(ensureDragonAge({ ages, eventLog: log, store: fakeDragonStore(null), log: quietLog }), null);
  assert.equal(dragonTotalsSince(log, ageStart).length, 2);
});

test('confirming a new age reports the old age number too', () => {
  const ages = newAges(tmpDir());
  ages.observeClock(clockAt('July 20 of YR8', dayStart('July 20 of YR8')));
  const newT0 = dayStart('July 20 of YR8') + 72 * H;
  ages.observeClock(clockAt('January 2 of YR0', newT0 + H));
  ages.observeClock(clockAt('January 3 of YR0', newT0 + 2 * H));
  let seen;
  ages.on('age-changed', (newAge, oldAge) => { seen = [newAge, oldAge]; });
  ages.confirmAgeChange();
  assert.deepEqual(seen, [118, 117]);
});
