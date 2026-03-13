const { getAll } = require('../handlers/dragonStore');

function formatNum(n) {
  return n.toLocaleString('en-US');
}

function buildDonationSection(provinces, nameWidth) {
  const sorted = [...provinces].sort((a, b) => {
    if (b.goldDonated !== a.goldDonated) return b.goldDonated - a.goldDonated;
    if (b.bushelsDonated !== a.bushelsDonated) return b.bushelsDonated - a.bushelsDonated;
    return a.province.localeCompare(b.province);
  });

  const lines = ['Gold Coins & Food Donated:', '-'.repeat(40)];
  let totalGold = 0;
  let totalBushels = 0;

  for (const p of sorted) {
    const name = p.province.padEnd(nameWidth);
    let value;
    if (p.bushelsDonated > 0) {
      value = `${formatNum(p.goldDonated)} gc & ${formatNum(p.bushelsDonated)} bushels`;
    } else {
      value = p.goldDonated > 0 ? formatNum(p.goldDonated) : '0';
    }
    lines.push(`${name} ${value}`);
    totalGold += p.goldDonated;
    totalBushels += p.bushelsDonated;
  }

  lines.push('');
  const totalValue = totalBushels > 0
    ? `${formatNum(totalGold)} gc & ${formatNum(totalBushels)} bushels`
    : formatNum(totalGold);
  lines.push(`${'Total'.padEnd(nameWidth)} ${totalValue}`);
  return lines.join('\n');
}

function buildAttackSection(provinces, nameWidth) {
  const sorted = [...provinces].sort((a, b) => {
    if (b.pointsWeakened !== a.pointsWeakened) return b.pointsWeakened - a.pointsWeakened;
    return a.province.localeCompare(b.province);
  });

  const lines = ['Troops Sent and Points Weakened:', '-'.repeat(40)];

  for (const p of sorted) {
    const name = p.province.padEnd(nameWidth);
    lines.push(`${name} Points: ${formatNum(p.pointsWeakened)}   Troops: ${formatNum(p.troopsSent)}`);
  }

  return lines.join('\n');
}

function generateDragonReport() {
  const provinces = getAll();
  if (provinces.length === 0) {
    return ['No data recorded yet.'];
  }

  const nameWidth = Math.max(...provinces.map((p) => p.province.length)) + 2;

  return [
    `**Dragon Summary**\n\`\`\`\n${buildDonationSection(provinces, nameWidth)}\n\`\`\``,
    `\`\`\`\n${buildAttackSection(provinces, nameWidth)}\n\`\`\``,
  ];
}

function generateForumReport() {
  const provinces = getAll();
  if (provinces.length === 0) {
    return ['No data recorded yet.'];
  }

  const nameWidth = Math.max(...provinces.map((p) => p.province.length)) + 2;

  return [
    `\`\`\`\nDragon Summary\n\n${buildDonationSection(provinces, nameWidth)}\n\`\`\``,
    `\`\`\`\n${buildAttackSection(provinces, nameWidth)}\n\`\`\``,
  ];
}

module.exports = { generateDragonReport, generateForumReport };
