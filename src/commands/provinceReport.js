const { SlashCommandBuilder } = require('discord.js');
const { getAid, getAttacks, getRituals, getEspionage, filterByProvince } = require('../handlers/eventStore');
const { getAll: getDragonData } = require('../handlers/dragonStore');
const { formatNum, sendChunked, periodLabel } = require('./commandUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('province-report')
    .setDescription('Cross-channel activity log for a specific province')
    .addStringOption((o) => o.setName('province').setDescription('Province name').setRequired(true))
    .addIntegerOption((o) => o.setName('period').setDescription('Only include events from the last N hours').setMinValue(1))
    .addStringOption((o) =>
      o.setName('type').setDescription('Filter by action type')
        .addChoices(
          { name: 'attacks', value: 'attacks' },
          { name: 'aid', value: 'aid' },
          { name: 'rituals', value: 'rituals' },
          { name: 'espionage', value: 'espionage' },
          { name: 'dragon', value: 'dragon' },
          { name: 'all', value: 'all' },
        )
    ),

  async execute(interaction) {
    const province = interaction.options.getString('province');
    const period = interaction.options.getInteger('period');
    const typeFilter = interaction.options.getString('type') || 'all';

    const entries = [];

    // Dragon (aggregate, no per-event timestamps)
    if (typeFilter === 'all' || typeFilter === 'dragon') {
      const dragon = getDragonData().find((d) => d.province.toLowerCase() === province.toLowerCase());
      if (dragon) {
        if (dragon.goldDonated > 0) {
          entries.push({ tag: 'DRAGON', date: '', text: `donated ${formatNum(dragon.goldDonated)} gc (total)` });
        }
        if (dragon.bushelsDonated > 0) {
          entries.push({ tag: 'DRAGON', date: '', text: `donated ${formatNum(dragon.bushelsDonated)} bushels (total)` });
        }
        if (dragon.troopsSent > 0) {
          entries.push({ tag: 'DRAGON', date: '', text: `sent ${formatNum(dragon.troopsSent)} troops, weakened ${formatNum(dragon.pointsWeakened)} pts (total)` });
        }
      }
    }

    // Attacks
    if (typeFilter === 'all' || typeFilter === 'attacks') {
      const attacks = filterByProvince(getAttacks(period), 'attacker', province);
      for (const e of attacks) {
        entries.push({
          tag: 'ATTACK',
          date: e.timestamp.slice(0, 10),
          ts: e.timestamp,
          text: (() => {
            if (e.attackType === 'capture')   return `attacked ${e.target} — ${formatNum(e.landsCapt)} acres captured`;
            if (e.attackType === 'recapture') return `attacked ${e.target} — ${formatNum(e.landsRecapt)} acres recaptured`;
            if (e.attackType === 'learn')     return `attacked ${e.target} — ${formatNum(e.learnPts)} pts (learn)`;
            if (e.attackType === 'raze')      return `attacked ${e.target} — ${formatNum(e.landsRazed)} acres razed`;
            if (e.attackType === 'plunder')   return `attacked ${e.target} — plunder: ${formatNum(e.plunderGold)} gc`;
            if (e.attackType === 'massacre')  return `attacked ${e.target} — ${formatNum(e.massacred)} civilians killed`;
            return `attacked ${e.target}`;
          })(),
        });
      }
    }

    // Aid sent
    if (typeFilter === 'all' || typeFilter === 'aid') {
      const aid = filterByProvince(getAid(period), 'sender', province);
      for (const e of aid) {
        entries.push({
          tag: 'AID',
          date: e.timestamp.slice(0, 10),
          ts: e.timestamp,
          text: `sent ${formatNum(e.amount)} ${e.resource} to ${e.receiver}`,
        });
      }
    }

    // Espionage
    if (typeFilter === 'all' || typeFilter === 'espionage') {
      const esp = filterByProvince(getEspionage(period), 'province', province);
      for (const e of esp) {
        const result = e.success ? 'SUCCESS' : 'FAIL';
        const extra = e.goldStolen > 0 ? `, ${formatNum(e.goldStolen)} gc stolen` :
                      e.thievesLost > 0 ? `, lost ${e.thievesLost} thieves` : '';
        entries.push({
          tag: 'TMS',
          date: e.timestamp.slice(0, 10),
          ts: e.timestamp,
          text: `${e.missionType} vs ${e.target} — ${result}${extra}`,
        });
      }
    }

    // Rituals
    if (typeFilter === 'all' || typeFilter === 'rituals') {
      const rit = filterByProvince(getRituals(period), 'province', province);
      for (const e of rit) {
        entries.push({
          tag: 'RITUAL',
          date: e.timestamp.slice(0, 10),
          ts: e.timestamp,
          text: `cast ritual (${e.castCount} total)`,
        });
      }
    }

    const timedEntries = entries.filter((e) => e.ts).sort((a, b) => new Date(b.ts) - new Date(a.ts));
    const dragonEntries = entries.filter((e) => !e.ts);

    const allEntries = [...dragonEntries, ...timedEntries];

    if (allEntries.length === 0) {
      return interaction.reply(`No data found for **${province}**${periodLabel(period)}.`);
    }

    const lines = [
      `Province Report: ${province}${periodLabel(period)}`,
      '-'.repeat(40),
      ...allEntries.map((e) => {
        const dateStr = e.date ? `  ${e.date}` : '            ';
        return `${e.tag.padEnd(6)}${dateStr}  ${e.text}`;
      }),
    ];

    return sendChunked(interaction, lines.join('\n'));
  },
};
