const DONATION_REGEX = /DRAGON (.+?) \[.*?\] donated ([\d,]+) (gold coins?|bushels) to fund dragon!/g;
const ATTACK_REGEX = /DRAGON (.+?) \[.*?\] sent ([\d,]+) troops and weakened dragon by ([\d,]+) points!/g;

// A single Discord message can contain multiple DRAGON lines when the
// source bot batches rapid-fire events, so every match must be collected.
function parseMessage(rawContent) {
  const content = rawContent.replace(/__/g, '').replace(/\*\*/g, '');
  const results = [];

  for (const [, province, amount, resource] of content.matchAll(DONATION_REGEX)) {
    const value = parseInt(amount.replace(/,/g, ''), 10);
    results.push({
      type: 'donation',
      province,
      goldDonated: resource === 'gold coins' ? value : 0,
      bushelsDonated: resource === 'bushels' ? value : 0,
    });
  }

  for (const [, province, troops, points] of content.matchAll(ATTACK_REGEX)) {
    results.push({
      type: 'attack',
      province,
      troopsSent: parseInt(troops.replace(/,/g, ''), 10),
      pointsWeakened: parseInt(points.replace(/,/g, ''), 10),
    });
  }

  return results;
}

module.exports = { parseMessage };
