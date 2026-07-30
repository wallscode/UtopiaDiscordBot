// Classifies tm-ops mission types (the text between << and | in a tm-ops
// message) so callers know what the mission's bold impact number means.
// Built from Utopia game mechanics: https://utopiawiki.com/index.php/Mystics
// and cross-checked against real tm-ops history in data/channel-dumps/tms.json.

const CATEGORY = { THIEVERY: 'thievery', SPELL: 'spell', INTEL: 'intel' };
const KIND = { CURRENCY: 'currency', DURATION: 'duration', COUNT: 'count', NONE: 'none' };

const TABLE = {
  // Thievery — currency stolen
  'rob the vaults': { category: CATEGORY.THIEVERY, kind: KIND.CURRENCY, unit: 'gc' },
  'rob the granaries': { category: CATEGORY.THIEVERY, kind: KIND.CURRENCY, unit: 'bushels' },
  'rob the towers': { category: CATEGORY.THIEVERY, kind: KIND.CURRENCY, unit: 'runes' },
  'steal war horses': { category: CATEGORY.THIEVERY, kind: KIND.CURRENCY, unit: 'war horses' },

  // Thievery — duration (days)
  'incite riots': { category: CATEGORY.THIEVERY, kind: KIND.DURATION, unit: 'days' },
  'sabotage wizards': { category: CATEGORY.THIEVERY, kind: KIND.DURATION, unit: 'days' },
  'destabilize guilds': { category: CATEGORY.THIEVERY, kind: KIND.DURATION, unit: 'days' },

  // Thievery — one-off count
  arson: { category: CATEGORY.THIEVERY, kind: KIND.COUNT, unit: 'acres burned' },
  'assassinate wizards': { category: CATEGORY.THIEVERY, kind: KIND.COUNT, unit: 'wizards killed' },
  'free prisoners': { category: CATEGORY.THIEVERY, kind: KIND.COUNT, unit: 'prisoners freed' },
  kidnap: { category: CATEGORY.THIEVERY, kind: KIND.COUNT, unit: 'peasants kidnapped' },
  kidnapping: { category: CATEGORY.THIEVERY, kind: KIND.COUNT, unit: 'peasants kidnapped' },
  'night strike': { category: CATEGORY.THIEVERY, kind: KIND.COUNT, unit: 'troops killed' },

  // Thievery — no numeric impact, success/fail only
  'bribe generals': { category: CATEGORY.THIEVERY, kind: KIND.NONE, unit: '' },
  'bribe thieves': { category: CATEGORY.THIEVERY, kind: KIND.NONE, unit: '' },

  // Spells — duration (days)
  'meteor showers': { category: CATEGORY.SPELL, kind: KIND.DURATION, unit: 'days' },
  pitfalls: { category: CATEGORY.SPELL, kind: KIND.DURATION, unit: 'days' },
  blizzard: { category: CATEGORY.SPELL, kind: KIND.DURATION, unit: 'days' },
  chastity: { category: CATEGORY.SPELL, kind: KIND.DURATION, unit: 'days' },
  drought: { category: CATEGORY.SPELL, kind: KIND.DURATION, unit: 'days' },
  droughts: { category: CATEGORY.SPELL, kind: KIND.DURATION, unit: 'days' },
  explosions: { category: CATEGORY.SPELL, kind: KIND.DURATION, unit: 'days' },
  'expose thieves': { category: CATEGORY.SPELL, kind: KIND.DURATION, unit: 'days' },
  gluttony: { category: CATEGORY.SPELL, kind: KIND.DURATION, unit: 'days' },
  greed: { category: CATEGORY.SPELL, kind: KIND.DURATION, unit: 'days' },
  nightfall: { category: CATEGORY.SPELL, kind: KIND.DURATION, unit: 'days' },
  storms: { category: CATEGORY.SPELL, kind: KIND.DURATION, unit: 'days' },

  // Spells — one-off count
  fireball: { category: CATEGORY.SPELL, kind: KIND.COUNT, unit: 'peasants killed' },
  'lightning strike': { category: CATEGORY.SPELL, kind: KIND.COUNT, unit: 'runes destroyed' },
  vermin: { category: CATEGORY.SPELL, kind: KIND.COUNT, unit: 'bushels destroyed' },
  'land lust': { category: CATEGORY.SPELL, kind: KIND.COUNT, unit: 'acres' },
  tornadoes: { category: CATEGORY.SPELL, kind: KIND.COUNT, unit: 'acres of buildings' },
  nightmare: { category: CATEGORY.SPELL, kind: KIND.COUNT, unit: 'men affected' },
  nightmares: { category: CATEGORY.SPELL, kind: KIND.COUNT, unit: 'men affected' },
  amnesia: { category: CATEGORY.SPELL, kind: KIND.COUNT, unit: 'books' },
  'soul blight': { category: CATEGORY.SPELL, kind: KIND.COUNT, unit: 'peasants killed' },
  "fool's gold": { category: CATEGORY.SPELL, kind: KIND.COUNT, unit: 'gold coins ruined' },
  'abolish ritual': { category: CATEGORY.SPELL, kind: KIND.COUNT, unit: 'ritual pts' },

  // Spells — no numeric impact
  'magic ward': { category: CATEGORY.SPELL, kind: KIND.NONE, unit: '' },
  'mystic vortex': { category: CATEGORY.SPELL, kind: KIND.NONE, unit: '' },

  // Intel — information gathering only, never mixed into thievery/spell totals
  'spy on throne': { category: CATEGORY.INTEL, kind: KIND.NONE, unit: '' },
  'spy on defense': { category: CATEGORY.INTEL, kind: KIND.NONE, unit: '' },
  'spy on exploration': { category: CATEGORY.INTEL, kind: KIND.NONE, unit: '' },
  'spy on military': { category: CATEGORY.INTEL, kind: KIND.NONE, unit: '' },
  'spy on sciences': { category: CATEGORY.INTEL, kind: KIND.NONE, unit: '' },
  survey: { category: CATEGORY.INTEL, kind: KIND.NONE, unit: '' },
  'snatch news': { category: CATEGORY.INTEL, kind: KIND.NONE, unit: '' },
  infiltrate: { category: CATEGORY.INTEL, kind: KIND.NONE, unit: '' },
  'infiltrate thieves guild': { category: CATEGORY.INTEL, kind: KIND.NONE, unit: '' },
  'crystal ball': { category: CATEGORY.INTEL, kind: KIND.NONE, unit: '' },
  'crystal eye': { category: CATEGORY.INTEL, kind: KIND.NONE, unit: '' },
};

// Mission types not in TABLE fall back to a bare count, categorized by which
// emoji prefixed the tm-ops line (see espionageParser.js's opIcon field).
const ICON_FALLBACK = {
  detective: { category: CATEGORY.THIEVERY, kind: KIND.COUNT, unit: '' },
  comet: { category: CATEGORY.SPELL, kind: KIND.COUNT, unit: '' },
};

function classify(missionType, opIcon) {
  const lower = (missionType || '').toLowerCase().trim();

  if (lower.startsWith('propaganda')) {
    const suffix = lower.slice('propaganda'.length).trim();
    return {
      category: CATEGORY.THIEVERY,
      kind: KIND.COUNT,
      unit: 'troops deserted',
      label: suffix ? `propaganda: ${suffix}` : 'propaganda',
    };
  }

  if (lower.startsWith('greater arson')) {
    const suffix = lower.slice('greater arson'.length).trim();
    return {
      category: CATEGORY.THIEVERY,
      kind: KIND.COUNT,
      unit: 'buildings burned',
      label: suffix ? `greater arson: ${suffix}` : 'greater arson',
    };
  }

  const known = TABLE[lower];
  if (known) return { ...known, label: lower };

  const fallback = ICON_FALLBACK[opIcon] || ICON_FALLBACK.detective;
  return { ...fallback, label: lower || 'unknown' };
}

module.exports = { classify, CATEGORY, KIND };
