const { SlashCommandBuilder } = require('discord.js');
const { getRituals, filterByProvince } = require('../handlers/eventStore');
const { getAll: getProvinces } = require('../handlers/provinceStore');
const { formatNum, sendChunked, periodLabel } = require('./commandUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ritual-stats')
    .setDescription('Show ritual casting stats per province')
    .addStringOption((o) => o.setName('province').setDescription('Filter to one province'))
    .addIntegerOption((o) => o.setName('period').setDescription('Only include events from the last N hours').setMinValue(1)),

  async execute(interaction) {
    const province = interaction.options.getString('province');
    const period = interaction.options.getInteger('period');
    const rituals = getRituals(period);

    if (province) {
      const events = filterByProvince(rituals, 'province', province)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      if (events.length === 0) {
        return interaction.reply(`No ritual data for **${province}**${periodLabel(period)}.`);
      }

      const lines = [
        `Ritual History: ${province}${periodLabel(period)}`,
        '-'.repeat(40),
        ...events.map((e) => {
          const date = e.timestamp.slice(0, 10);
          return `${date}  cast ritual (${e.castCount} total)`;
        }),
      ];
      return sendChunked(interaction, lines.join('\n'));
    }

    // Kingdom-wide summary
    const totals = new Map();
    for (const r of rituals) {
      const key = r.province.toLowerCase();
      const existing = totals.get(key);
      if (!existing || r.castCount > existing.castCount) {
        totals.set(key, { province: r.province, castCount: r.castCount });
      }
    }

    // Include all inventory provinces with 0 if not present
    for (const name of getProvinces()) {
      if (!totals.has(name.toLowerCase())) {
        totals.set(name.toLowerCase(), { province: name, castCount: 0 });
      }
    }

    const sorted = [...totals.values()].sort((a, b) => b.castCount - a.castCount);
    const nameWidth = Math.max(...sorted.map((r) => r.province.length)) + 2;

    const lines = [
      `Ritual Summary${periodLabel(period)}`,
      '-'.repeat(40),
      ...sorted.map((r) => {
        const cast = r.castCount === 1 ? '1 cast' : `${formatNum(r.castCount)} casts`;
        return `${r.province.padEnd(nameWidth)} ${cast}`;
      }),
    ];
    return sendChunked(interaction, lines.join('\n'));
  },
};
