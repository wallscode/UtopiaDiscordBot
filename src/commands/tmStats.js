const { SlashCommandBuilder } = require('discord.js');
const { getEspionage, filterByProvince } = require('../handlers/eventStore');
const { getAll: getProvinces } = require('../handlers/provinceStore');
const { formatNum, formatAvg, sendChunked, periodLabel } = require('./commandUtils');
const { classify, CATEGORY, KIND } = require('../parsers/missionTypes');

const SECTION_ORDER = [CATEGORY.THIEVERY, CATEGORY.SPELL, CATEGORY.INTEL];
const SECTION_TITLES = {
  [CATEGORY.THIEVERY]: 'THIEVERY',
  [CATEGORY.SPELL]: 'SPELLS',
  [CATEGORY.INTEL]: 'INTEL',
};

function categoryForFilter(typeFilter) {
  if (typeFilter === 'thievery') return CATEGORY.THIEVERY;
  if (typeFilter === 'spells') return CATEGORY.SPELL;
  if (typeFilter === 'intel') return CATEGORY.INTEL;
  return null;
}

function formatRow(r, labelWidth) {
  const pct = r.count > 0 ? ((r.success / r.count) * 100).toFixed(0) : '0';
  const base = `  ${String(r.count).padStart(2)}  ${r.meta.label.padEnd(labelWidth)} ${String(r.success).padStart(2)} ok  ${String(r.fail).padStart(2)} fail  ${pct}%`;
  if (r.meta.kind === KIND.NONE || r.success === 0) return base;
  const avg = r.total / r.success;
  const avgStr = r.success > 1 ? `  (avg ${formatAvg(avg)})` : '';
  return `${base}   ${formatNum(r.total)} ${r.meta.unit}${avgStr}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tm-stats')
    .setDescription('Show thievery, spell, and intel statistics from tm-ops')
    .addStringOption((o) => o.setName('province').setDescription('Filter to one province'))
    .addIntegerOption((o) => o.setName('period').setDescription('Only include events from the last N hours').setMinValue(1))
    .addStringOption((o) =>
      o.setName('type').setDescription('Filter by operation category')
        .addChoices(
          { name: 'thievery', value: 'thievery' },
          { name: 'spells', value: 'spells' },
          { name: 'intel', value: 'intel' },
          { name: 'all', value: 'all' }
        )
    ),

  async execute(interaction) {
    const province = interaction.options.getString('province');
    const period = interaction.options.getInteger('period');
    const typeFilter = interaction.options.getString('type') || 'all';
    const categoryFilter = categoryForFilter(typeFilter);

    let tmOps = getEspionage(period);
    if (categoryFilter) {
      tmOps = tmOps.filter((e) => classify(e.missionType, e.opIcon).category === categoryFilter);
    }

    if (province) {
      const events = filterByProvince(tmOps, 'province', province)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      if (events.length === 0) {
        return interaction.reply(`No tm-ops data for **${province}**${periodLabel(period)}.`);
      }

      const success = events.filter((e) => e.success).length;
      const fail = events.length - success;
      const rate = events.length > 0 ? ((success / events.length) * 100).toFixed(1) : '0.0';
      const lostThieves = events.reduce((s, e) => s + (e.lostUnit === 'thieves' ? e.lostCount : 0), 0);
      const lostWizards = events.reduce((s, e) => s + (e.lostUnit === 'wizards' ? e.lostCount : 0), 0);
      const lostParts = [];
      if (lostThieves) lostParts.push(`${lostThieves} thieves`);
      if (lostWizards) lostParts.push(`${lostWizards} wizards`);

      const byType = new Map();
      for (const e of events) {
        const meta = classify(e.missionType, e.opIcon);
        if (!byType.has(e.missionType)) {
          byType.set(e.missionType, { meta, count: 0, success: 0, fail: 0, total: 0 });
        }
        const r = byType.get(e.missionType);
        r.count++;
        if (e.success) { r.success++; r.total += e.impactValue; } else { r.fail++; }
      }

      const labelWidth = Math.max(...[...byType.values()].map((r) => r.meta.label.length)) + 1;
      const grouped = { [CATEGORY.THIEVERY]: [], [CATEGORY.SPELL]: [], [CATEGORY.INTEL]: [] };
      for (const r of byType.values()) grouped[r.meta.category].push(r);
      for (const cat of SECTION_ORDER) grouped[cat].sort((a, b) => b.count - a.count);

      const lines = [
        `TM-OPS: ${province}${periodLabel(period)}`,
        '-'.repeat(40),
        `Total ops:  ${events.length}  (${success} ok, ${fail} fail, ${rate}%)`,
        `Lost:       ${lostParts.length ? lostParts.join(', ') : '0'}`,
      ];

      for (const cat of SECTION_ORDER) {
        if (grouped[cat].length === 0) continue;
        lines.push('', SECTION_TITLES[cat]);
        for (const r of grouped[cat]) lines.push(formatRow(r, labelWidth));
      }

      return sendChunked(interaction, lines.join('\n'));
    }

    // Kingdom-wide summary
    const byProvince = new Map();
    for (const name of getProvinces()) {
      byProvince.set(name.toLowerCase(), {
        province: name, total: 0, success: 0, lost: 0, gold: 0, spellDays: 0,
      });
    }

    for (const e of tmOps) {
      const key = e.province.toLowerCase();
      if (!byProvince.has(key)) {
        byProvince.set(key, {
          province: e.province, total: 0, success: 0, lost: 0, gold: 0, spellDays: 0,
        });
      }
      const r = byProvince.get(key);
      r.total++;
      r.lost += e.lostCount;
      if (e.success) {
        r.success++;
        const meta = classify(e.missionType, e.opIcon);
        if (meta.category === CATEGORY.THIEVERY && meta.kind === KIND.CURRENCY && meta.unit === 'gc') {
          r.gold += e.impactValue;
        }
        if (meta.category === CATEGORY.SPELL && meta.kind === KIND.DURATION) {
          r.spellDays += e.impactValue;
        }
      }
    }

    const sorted = [...byProvince.values()].sort((a, b) => b.total - a.total);
    const nameWidth = Math.max(...sorted.map((r) => r.province.length)) + 2;

    const lines = [
      `TM-OPS Summary${periodLabel(period)}`,
      '-'.repeat(40),
      ...sorted.map((r) => {
        const fail = r.total - r.success;
        const rate = r.total > 0 ? ((r.success / r.total) * 100).toFixed(1) : '0.0';
        const gold = r.gold > 0 ? `  gc: ${formatNum(r.gold)}` : '';
        const spellDays = r.spellDays > 0 ? `  spell-days: ${formatNum(r.spellDays)}` : '';
        return `${r.province.padEnd(nameWidth)} ${r.total} ops  |  ${r.success} ok  ${fail} fail  ${rate}%  |  lost: ${r.lost}${gold}${spellDays}`;
      }),
    ];
    return sendChunked(interaction, lines.join('\n'));
  },
};
