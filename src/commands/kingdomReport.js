const { SlashCommandBuilder } = require('discord.js');
const { getAid, getAttacks, getRituals, getEspionage, filterByProvince } = require('../handlers/eventStore');
const { getAll: getDragonData } = require('../handlers/dragonStore');
const { getProvince: getActivity } = require('../handlers/activityStore');
const { formatNum, sendChunked, periodLabel } = require('./commandUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kingdom-report')
    .setDescription('Comprehensive cross-channel report for a single province')
    .addStringOption((o) => o.setName('province').setDescription('Province name').setRequired(true))
    .addIntegerOption((o) => o.setName('period').setDescription('Only include events from the last N hours').setMinValue(1)),

  async execute(interaction) {
    const province = interaction.options.getString('province');
    const period = interaction.options.getInteger('period');

    const lines = [
      `Kingdom Report: ${province}${periodLabel(period)}`,
      '='.repeat(40),
    ];

    // Last seen
    const act = getActivity(province);
    if (act) {
      const ts = new Date(act.timestamp);
      const hoursAgo = ((Date.now() - ts.getTime()) / 3_600_000).toFixed(1);
      lines.push(`Last seen: ${act.timestamp.slice(0, 16).replace('T', ' ')} UTC  (${hoursAgo}h ago)  [${act.action}]`);
    } else {
      lines.push('Last seen: no activity recorded');
    }

    lines.push('');

    // Dragon
    const dragon = getDragonData().find((d) => d.province.toLowerCase() === province.toLowerCase());
    lines.push('DRAGON CONTRIBUTIONS');
    lines.push('-'.repeat(40));
    if (dragon && (dragon.goldDonated + dragon.bushelsDonated + dragon.troopsSent > 0)) {
      if (dragon.goldDonated > 0)     lines.push(`  GC donated:       ${formatNum(dragon.goldDonated)}`);
      if (dragon.bushelsDonated > 0)  lines.push(`  Bushels donated:  ${formatNum(dragon.bushelsDonated)}`);
      if (dragon.troopsSent > 0)      lines.push(`  Troops sent:      ${formatNum(dragon.troopsSent)}`);
      if (dragon.pointsWeakened > 0)  lines.push(`  Points weakened:  ${formatNum(dragon.pointsWeakened)}`);
    } else {
      lines.push('  No dragon activity');
    }

    lines.push('');

    // Aid
    const aidSent = filterByProvince(getAid(period), 'sender', province);
    const aidRecv = filterByProvince(getAid(period), 'receiver', province);
    lines.push('AID');
    lines.push('-'.repeat(40));
    if (aidSent.length === 0 && aidRecv.length === 0) {
      lines.push('  No aid activity');
    } else {
      const RESOURCES = ['gold', 'bushels', 'soldiers', 'runes'];
      const sentTotals = { gold: 0, bushels: 0, soldiers: 0, runes: 0 };
      for (const e of aidSent) sentTotals[e.resource] += e.amount;
      const recvTotals = { gold: 0, bushels: 0, soldiers: 0, runes: 0 };
      for (const e of aidRecv) recvTotals[e.resource] += e.amount;

      lines.push('  Sent:');
      for (const r of RESOURCES) {
        if (sentTotals[r] > 0) lines.push(`    ${r.padEnd(10)} ${formatNum(sentTotals[r])}`);
      }
      if (RESOURCES.every((r) => sentTotals[r] === 0)) lines.push('    none');

      lines.push('  Received:');
      for (const r of RESOURCES) {
        if (recvTotals[r] > 0) lines.push(`    ${r.padEnd(10)} ${formatNum(recvTotals[r])}`);
      }
      if (RESOURCES.every((r) => recvTotals[r] === 0)) lines.push('    none');
    }

    lines.push('');

    // Attacks
    const attacks = filterByProvince(getAttacks(period), 'attacker', province);
    lines.push('ATTACKS');
    lines.push('-'.repeat(40));
    if (attacks.length === 0) {
      lines.push('  No attack data');
    } else {
      lines.push(`  Total attacks:  ${attacks.length}`);
      const byType = (type) => attacks.filter((a) => a.attackType === type);
      const cap = byType('capture');
      const recap = byType('recapture');
      const learn = byType('learn');
      const raze = byType('raze');
      const plunder = byType('plunder');
      const massacre = byType('massacre');
      if (cap.length > 0)     lines.push(`  Capture:        ${cap.length} (${formatNum(cap.reduce((s, a) => s + a.landsCapt, 0))} acres)`);
      if (recap.length > 0)   lines.push(`  Recapture:      ${recap.length} (${formatNum(recap.reduce((s, a) => s + a.landsRecapt, 0))} acres)`);
      if (learn.length > 0)   lines.push(`  Learn:          ${learn.length} (${formatNum(learn.reduce((s, a) => s + a.learnPts, 0))} pts)`);
      if (raze.length > 0)    lines.push(`  Raze:           ${raze.length} (${formatNum(raze.reduce((s, a) => s + a.landsRazed, 0))} acres)`);
      if (plunder.length > 0) lines.push(`  Plunder:        ${plunder.length} (${formatNum(plunder.reduce((s, a) => s + a.plunderGold, 0))} gc)`);
      if (massacre.length > 0) lines.push(`  Massacre:       ${massacre.length} (${formatNum(massacre.reduce((s, a) => s + a.massacred, 0))} killed)`);
    }

    lines.push('');

    // Espionage
    const esp = filterByProvince(getEspionage(period), 'province', province);
    lines.push('ESPIONAGE / THIEVERY');
    lines.push('-'.repeat(40));
    if (esp.length === 0) {
      lines.push('  No espionage data');
    } else {
      const success = esp.filter((e) => e.success).length;
      const fail = esp.length - success;
      const rate = ((success / esp.length) * 100).toFixed(1);
      const thievesLost = esp.reduce((s, e) => s + e.thievesLost, 0);
      const goldStolen = esp.reduce((s, e) => s + e.goldStolen, 0);
      lines.push(`  Total ops:      ${esp.length}  (${success} ok, ${fail} fail, ${rate}%)`);
      lines.push(`  Thieves lost:   ${thievesLost}`);
      if (goldStolen > 0) lines.push(`  Gold stolen:    ${formatNum(goldStolen)}`);
    }

    lines.push('');

    // Rituals
    const rit = filterByProvince(getRituals(period), 'province', province);
    lines.push('RITUALS');
    lines.push('-'.repeat(40));
    if (rit.length === 0) {
      lines.push('  No ritual data');
    } else {
      const maxCast = Math.max(...rit.map((r) => r.castCount));
      lines.push(`  Cast events:    ${rit.length}`);
      lines.push(`  Total casts:    ${formatNum(maxCast)}`);
    }

    return sendChunked(interaction, lines.join('\n'));
  },
};
