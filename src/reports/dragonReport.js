const { getAggregated: getDragonData } = require('../handlers/dragonStore');
const { getAll: getProvinces } = require('../handlers/provinceStore');

// `source`, when given, replaces the dragon store: { entries, label } where
// entries are per-province totals (a war's, from its stored record) and label
// goes after "Dragon Summary" in the title.
function getMergedProvinces(periodHours, source) {
  const dragonData = source ? source.entries : getDragonData(periodHours);
  const dragonMap = new Map(dragonData.map((p) => [p.province.toLowerCase(), p]));
  const inventory = getProvinces();

  // Start with all inventory provinces, filling in dragon data where available
  const merged = new Map();
  for (const name of inventory) {
    merged.set(name.toLowerCase(), dragonMap.get(name.toLowerCase()) ?? {
      province: name,
      goldDonated: 0,
      bushelsDonated: 0,
      troopsSent: 0,
      pointsWeakened: 0,
    });
  }

  // Include any provinces from dragon data not in the inventory
  for (const entry of dragonData) {
    if (!merged.has(entry.province.toLowerCase())) {
      merged.set(entry.province.toLowerCase(), entry);
    }
  }

  return [...merged.values()];
}

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
    const value = `GC: ${formatNum(p.goldDonated)}   Bushels: ${formatNum(p.bushelsDonated)}`;
    lines.push(`${name} ${value}`);
    totalGold += p.goldDonated;
    totalBushels += p.bushelsDonated;
  }

  lines.push('');
  lines.push(`${'Total'.padEnd(nameWidth)} GC: ${formatNum(totalGold)}   Bushels: ${formatNum(totalBushels)}`);
  return lines.join('\n');
}

function buildAttackSection(provinces, nameWidth) {
  const sorted = [...provinces].sort((a, b) => {
    if (b.pointsWeakened !== a.pointsWeakened) return b.pointsWeakened - a.pointsWeakened;
    return a.province.localeCompare(b.province);
  });

  const lines = ['Troops Sent and Points Weakened:', '-'.repeat(40)];
  let totalPoints = 0;
  let totalTroops = 0;

  for (const p of sorted) {
    const name = p.province.padEnd(nameWidth);
    lines.push(`${name} Points: ${formatNum(p.pointsWeakened)}   Troops: ${formatNum(p.troopsSent)}`);
    totalPoints += p.pointsWeakened;
    totalTroops += p.troopsSent;
  }

  lines.push('');
  lines.push(`${'Total'.padEnd(nameWidth)} Points: ${formatNum(totalPoints)}   Troops: ${formatNum(totalTroops)}`);
  return lines.join('\n');
}

function titleSuffix(periodHours, source) {
  if (source) return source.label;
  return periodHours ? ` (last ${periodHours}h)` : '';
}

function generateDragonReport(periodHours, source) {
  const provinces = getMergedProvinces(periodHours, source);
  if (provinces.length === 0) {
    return ['No data recorded yet.'];
  }

  const nameWidth = Math.max(...provinces.map((p) => p.province.length)) + 2;
  const periodLine = titleSuffix(periodHours, source);

  return [
    `**Dragon Summary${periodLine}**\n\`\`\`\n${buildDonationSection(provinces, nameWidth)}\n\`\`\``,
    `\`\`\`\n${buildAttackSection(provinces, nameWidth)}\n\`\`\``,
  ];
}

function generateForumReport(periodHours, source) {
  const provinces = getMergedProvinces(periodHours, source);
  if (provinces.length === 0) {
    return ['No data recorded yet.'];
  }

  const nameWidth = Math.max(...provinces.map((p) => p.province.length)) + 2;
  const periodLine = titleSuffix(periodHours, source);

  return [
    `\`\`\`\nDragon Summary${periodLine}\n\n${buildDonationSection(provinces, nameWidth)}\n\`\`\``,
    `\`\`\`\n${buildAttackSection(provinces, nameWidth)}\n\`\`\``,
  ];
}

function generateMobileForumReport(periodHours, source) {
  const provinces = getMergedProvinces(periodHours, source);
  if (provinces.length === 0) {
    return ['No data recorded yet.'];
  }
  const periodLine = titleSuffix(periodHours, source);

  const nameWidth = Math.max(...provinces.map((p) => p.province.length)) + 2;

  const donationLines = buildDonationSection(provinces, nameWidth)
    .replace('Gold Coins & Food Donated:', '<b>Gold Coins & Food Donated:</b>')
    .split('\n').join('<br>');

  const attackLines = buildAttackSection(provinces, nameWidth)
    .replace('Troops Sent and Points Weakened:', '<b>Troops Sent and Points Weakened:</b>')
    .split('\n').join('<br>');

  return [
    `\`\`\`\n<pre><b>Dragon Summary${periodLine}</b><br><br>${donationLines}</pre>\n\`\`\``,
    `\`\`\`\n<pre>${attackLines}</pre>\n\`\`\``,
  ];
}

module.exports = { generateDragonReport, generateForumReport, generateMobileForumReport };
