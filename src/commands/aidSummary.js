const { SlashCommandBuilder } = require('discord.js');
const { getAid, filterByProvince } = require('../handlers/eventStore');
const { getAll: getProvinces } = require('../handlers/provinceStore');
const { formatNum, sendChunked, periodLabel } = require('./commandUtils');

const RESOURCES = ['gold', 'bushels', 'soldiers', 'runes'];

function emptyTotals() {
  return { gold: 0, bushels: 0, soldiers: 0, runes: 0 };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aid-summary')
    .setDescription('Show resource aid sent and received per province')
    .addStringOption((o) => o.setName('province').setDescription('Filter to one province'))
    .addIntegerOption((o) => o.setName('period').setDescription('Only include events from the last N hours').setMinValue(1))
    .addStringOption((o) =>
      o.setName('type').setDescription('Filter by resource type')
        .addChoices(
          { name: 'gold', value: 'gold' },
          { name: 'bushels', value: 'bushels' },
          { name: 'soldiers', value: 'soldiers' },
          { name: 'runes', value: 'runes' }
        )
    ),

  async execute(interaction) {
    const province = interaction.options.getString('province');
    const period = interaction.options.getInteger('period');
    const typeFilter = interaction.options.getString('type');
    let aid = getAid(period);

    if (typeFilter) aid = aid.filter((e) => e.resource === typeFilter);

    if (province) {
      const sent = filterByProvince(aid, 'sender', province);
      const received = filterByProvince(aid, 'receiver', province);

      const sentTotals = emptyTotals();
      for (const e of sent) sentTotals[e.resource] = (sentTotals[e.resource] ?? 0) + e.amount;

      const recvTotals = emptyTotals();
      for (const e of received) recvTotals[e.resource] = (recvTotals[e.resource] ?? 0) + e.amount;

      const lines = [
        `Aid Summary: ${province}${periodLabel(period)}`,
        '-'.repeat(40),
        'Sent:',
        ...RESOURCES.map((r) => `  ${r.padEnd(10)} ${formatNum(sentTotals[r])}`),
        '',
        'Received:',
        ...RESOURCES.map((r) => `  ${r.padEnd(10)} ${formatNum(recvTotals[r])}`),
      ];

      if (sent.length + received.length > 0) {
        lines.push('', 'Transactions:', '-'.repeat(40));
        const all = [
          ...sent.map((e) => ({ ...e, dir: '→ sent to', other: e.receiver })),
          ...received.map((e) => ({ ...e, dir: '← recv from', other: e.sender })),
        ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        for (const e of all) {
          const date = e.timestamp.slice(0, 10);
          lines.push(`${date}  ${e.dir} ${e.other}  ${formatNum(e.amount)} ${e.resource}`);
        }
      }

      return sendChunked(interaction, lines.join('\n'));
    }

    // Kingdom-wide summary
    const sentMap = new Map();
    const recvMap = new Map();

    for (const name of getProvinces()) {
      sentMap.set(name.toLowerCase(), { province: name, ...emptyTotals() });
      recvMap.set(name.toLowerCase(), { province: name, ...emptyTotals() });
    }

    for (const e of aid) {
      const sk = e.sender.toLowerCase();
      if (!sentMap.has(sk)) sentMap.set(sk, { province: e.sender, ...emptyTotals() });
      sentMap.get(sk)[e.resource] += e.amount;

      const rk = e.receiver.toLowerCase();
      if (!recvMap.has(rk)) recvMap.set(rk, { province: e.receiver, ...emptyTotals() });
      recvMap.get(rk)[e.resource] += e.amount;
    }

    const sentList = [...sentMap.values()].sort((a, b) => (b.gold + b.bushels) - (a.gold + a.bushels));
    const recvList = [...recvMap.values()].sort((a, b) => (b.gold + b.bushels) - (a.gold + a.bushels));
    const nameWidth = Math.max(...sentList.map((r) => r.province.length)) + 2;

    const resources = typeFilter ? [typeFilter] : RESOURCES;

    const lines = [
      `Aid Summary — Sent${periodLabel(period)}`,
      '-'.repeat(40),
      ...sentList.map((r) => {
        const vals = resources.map((res) => `${res}: ${formatNum(r[res])}`).join('  |  ');
        return `${r.province.padEnd(nameWidth)} ${vals}`;
      }),
      '',
      `Aid Summary — Received${periodLabel(period)}`,
      '-'.repeat(40),
      ...recvList.map((r) => {
        const vals = resources.map((res) => `${res}: ${formatNum(r[res])}`).join('  |  ');
        return `${r.province.padEnd(nameWidth)} ${vals}`;
      }),
    ];

    return sendChunked(interaction, lines.join('\n'));
  },
};
