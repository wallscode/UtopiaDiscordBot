const { SlashCommandBuilder } = require('discord.js');
const { getEspionage, filterByProvince } = require('../handlers/eventStore');
const { getAll: getProvinces } = require('../handlers/provinceStore');
const { formatNum, sendChunked, periodLabel } = require('./commandUtils');

function missionMatches(missionType, filter) {
  if (!filter || filter === 'all') return true;
  return missionType.toLowerCase().includes(filter);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('espionage-stats')
    .setDescription('Show espionage and thievery statistics')
    .addStringOption((o) => o.setName('province').setDescription('Filter to one province'))
    .addIntegerOption((o) => o.setName('period').setDescription('Only include events from the last N hours').setMinValue(1))
    .addStringOption((o) =>
      o.setName('type').setDescription('Filter by operation type')
        .addChoices(
          { name: 'spy', value: 'spy' },
          { name: 'rob', value: 'rob' },
          { name: 'survey', value: 'survey' },
          { name: 'arson', value: 'arson' },
          { name: 'all', value: 'all' }
        )
    ),

  async execute(interaction) {
    const province = interaction.options.getString('province');
    const period = interaction.options.getInteger('period');
    const typeFilter = interaction.options.getString('type');

    let espionage = getEspionage(period).filter((e) => missionMatches(e.missionType, typeFilter));

    if (province) {
      const events = filterByProvince(espionage, 'province', province)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      if (events.length === 0) {
        return interaction.reply(`No espionage data for **${province}**${periodLabel(period)}.`);
      }

      const success = events.filter((e) => e.success).length;
      const fail = events.length - success;
      const thievesLost = events.reduce((s, e) => s + e.thievesLost, 0);
      const goldStolen = events.reduce((s, e) => s + e.goldStolen, 0);
      const rate = events.length > 0 ? ((success / events.length) * 100).toFixed(1) : '0.0';

      const byType = new Map();
      for (const e of events) {
        if (!byType.has(e.missionType)) byType.set(e.missionType, { count: 0, impact: 0 });
        const r = byType.get(e.missionType);
        r.count++;
        r.impact += e.goldStolen;
      }
      const typeRows = [...byType.entries()].sort((a, b) => b[1].count - a[1].count);

      const lines = [
        `Espionage Stats: ${province}${periodLabel(period)}`,
        '-'.repeat(40),
        `Total ops:     ${events.length}  (${success} success, ${fail} fail, ${rate}%)`,
        `Thieves lost:  ${thievesLost}`,
        '',
        ...typeRows.map(([type, r]) => {
          const impactStr = r.impact > 0 ? `  ${formatNum(r.impact)}` : '';
          return `  ${r.count}  ${type}${impactStr}`;
        }),
      ];
      return sendChunked(interaction, lines.join('\n'));
    }

    // Kingdom-wide summary
    const byProvince = new Map();
    for (const name of getProvinces()) {
      byProvince.set(name.toLowerCase(), {
        province: name, total: 0, success: 0, thievesLost: 0, goldStolen: 0,
      });
    }

    for (const e of espionage) {
      const key = e.province.toLowerCase();
      if (!byProvince.has(key)) {
        byProvince.set(key, { province: e.province, total: 0, success: 0, thievesLost: 0, goldStolen: 0 });
      }
      const r = byProvince.get(key);
      r.total++;
      if (e.success) r.success++;
      r.thievesLost += e.thievesLost;
      r.goldStolen += e.goldStolen;
    }

    const sorted = [...byProvince.values()].sort((a, b) => b.total - a.total);
    const nameWidth = Math.max(...sorted.map((r) => r.province.length)) + 2;

    const lines = [
      `Espionage Summary${periodLabel(period)}`,
      '-'.repeat(40),
      ...sorted.map((r) => {
        const fail = r.total - r.success;
        const rate = r.total > 0 ? ((r.success / r.total) * 100).toFixed(1) : '0.0';
        const gold = r.goldStolen > 0 ? `  gc stolen: ${formatNum(r.goldStolen)}` : '';
        return `${r.province.padEnd(nameWidth)} ${r.total} ops  |  ${r.success} ok  ${fail} fail  ${rate}%  |  lost: ${r.thievesLost}${gold}`;
      }),
    ];
    return sendChunked(interaction, lines.join('\n'));
  },
};
