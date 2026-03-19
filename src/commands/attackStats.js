const { SlashCommandBuilder } = require('discord.js');
const { getAttacks, filterByProvince } = require('../handlers/eventStore');
const { getAll: getProvinces } = require('../handlers/provinceStore');
const { formatNum, sendChunked, periodLabel } = require('./commandUtils');

const TYPES = ['capture', 'recapture', 'learn', 'raze', 'plunder', 'massacre', 'unknown'];

function summarize(attacks) {
  const byType = {};
  for (const t of TYPES) byType[t] = [];
  for (const a of attacks) byType[a.attackType ?? 'unknown'].push(a);

  return {
    count:          attacks.length,
    landsCapt:      byType.capture.reduce((s, a) => s + a.landsCapt, 0),
    captureCount:   byType.capture.length,
    landsRecapt:    byType.recapture.reduce((s, a) => s + a.landsRecapt, 0),
    recaptureCount: byType.recapture.length,
    learnPts:       byType.learn.reduce((s, a) => s + a.learnPts, 0),
    learnCount:     byType.learn.length,
    landsRazed:     byType.raze.reduce((s, a) => s + a.landsRazed, 0),
    razeCount:      byType.raze.length,
    plunderGold:    byType.plunder.reduce((s, a) => s + a.plunderGold, 0),
    plunderBushels: byType.plunder.reduce((s, a) => s + a.plunderBushels, 0),
    plunderRunes:   byType.plunder.reduce((s, a) => s + a.plunderRunes, 0),
    plunderCount:   byType.plunder.length,
    massacred:      byType.massacre.reduce((s, a) => s + a.massacred, 0),
    massacreCount:  byType.massacre.length,
  };
}

function formatProvinceSummary(s, nameWidth, name) {
  const parts = [];
  const landCount = s.captureCount + s.recaptureCount;
  const landAcres = s.landsCapt + s.landsRecapt;
  if (landCount > 0)        parts.push(`land: ${landCount} (${formatNum(landAcres)})`);
  if (s.learnCount > 0)     parts.push(`learn: ${s.learnCount} (${formatNum(s.learnPts)})`);
  if (s.razeCount > 0)      parts.push(`raze: ${s.razeCount} (${formatNum(s.landsRazed)})`);
  if (s.plunderCount > 0)   parts.push(`plunder: ${s.plunderCount} (${formatNum(s.plunderGold)} gc)`);
  if (s.massacreCount > 0)  parts.push(`mass: ${s.massacreCount} (${formatNum(s.massacred)})`);
  const detail = parts.length > 0 ? `  |  ${parts.join('  |  ')}` : '';
  return `${name.padEnd(nameWidth)} ${s.count}${detail}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('attack-stats')
    .setDescription('Show military attack statistics')
    .addStringOption((o) => o.setName('province').setDescription('Filter to one province'))
    .addIntegerOption((o) => o.setName('period').setDescription('Only include events from the last N hours').setMinValue(1)),

  async execute(interaction) {
    const province = interaction.options.getString('province');
    const period = interaction.options.getInteger('period');
    const attacks = getAttacks(period);

    if (province) {
      const events = filterByProvince(attacks, 'attacker', province)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      if (events.length === 0) {
        return interaction.reply(`No attack data for **${province}**${periodLabel(period)}.`);
      }

      const s = summarize(events);
      const lines = [
        `Attack Stats: ${province}${periodLabel(period)}`,
        '-'.repeat(40),
        `Total attacks:  ${s.count}`,
        ...(s.captureCount   > 0 ? [`  Capture:   ${s.captureCount} attacks  |  ${formatNum(s.landsCapt)} acres captured`] : []),
        ...(s.recaptureCount > 0 ? [`  Recapture: ${s.recaptureCount} attacks  |  ${formatNum(s.landsRecapt)} acres recaptured`] : []),
        ...(s.learnCount     > 0 ? [`  Learn:     ${s.learnCount} attacks  |  ${formatNum(s.learnPts)} pts earned`] : []),
        ...(s.razeCount      > 0 ? [`  Raze:      ${s.razeCount} attacks  |  ${formatNum(s.landsRazed)} acres razed`] : []),
        ...(s.plunderCount   > 0 ? [`  Plunder:   ${s.plunderCount} attacks  |  gc: ${formatNum(s.plunderGold)}  bushels: ${formatNum(s.plunderBushels)}  runes: ${formatNum(s.plunderRunes)}`] : []),
        ...(s.massacreCount  > 0 ? [`  Mass:      ${s.massacreCount} attacks  |  ${formatNum(s.massacred)} civilians killed`] : []),
        '',
        'Individual attacks:',
        '-'.repeat(40),
        ...events.map((e) => {
          const date = e.timestamp.slice(0, 10);
          const type = (e.attackType ?? 'unknown').padEnd(9);
          let detail = '';
          if (e.attackType === 'capture')   detail = `${formatNum(e.landsCapt)} acres`;
          else if (e.attackType === 'recapture') detail = `${formatNum(e.landsRecapt)} acres recaptured`;
          else if (e.attackType === 'learn')     detail = `${formatNum(e.learnPts)} pts`;
          else if (e.attackType === 'raze')      detail = `${formatNum(e.landsRazed)} acres razed`;
          else if (e.attackType === 'plunder')   detail = `gc: ${formatNum(e.plunderGold)}`;
          else if (e.attackType === 'massacre')  detail = `${formatNum(e.massacred)} killed`;
          return `${date}  [${type}]  attacked ${e.target}  ${detail}`;
        }),
      ];
      return sendChunked(interaction, lines.join('\n'));
    }

    // Kingdom-wide summary
    const byProvince = new Map();
    for (const a of attacks) {
      const key = a.attacker.toLowerCase();
      if (!byProvince.has(key)) byProvince.set(key, { province: a.attacker, list: [] });
      byProvince.get(key).list.push(a);
    }
    for (const name of getProvinces()) {
      if (!byProvince.has(name.toLowerCase())) {
        byProvince.set(name.toLowerCase(), { province: name, list: [] });
      }
    }

    const sorted = [...byProvince.values()]
      .map(({ province, list }) => ({ province, ...summarize(list) }))
      .sort((a, b) => b.count - a.count);

    const nameWidth = Math.max(...sorted.map((r) => r.province.length)) + 2;

    const lines = [
      `Attack Summary${periodLabel(period)}`,
      '-'.repeat(40),
      ...sorted.map((r) => formatProvinceSummary(r, nameWidth, r.province)),
    ];
    return sendChunked(interaction, lines.join('\n'));
  },
};
