const DONATION_REGEX = /DRAGON (.+?) \[.+?\] donated ([\d,]+) (gold coins|bushels) to fund dragon!/;
const ATTACK_REGEX = /DRAGON (.+?) \[.+?\] sent ([\d,]+) troops and weakened dragon by ([\d,]+) points!/;

function parseMessage(rawContent) {
  const content = rawContent.replace(/__/g, '');
  const donationMatch = content.match(DONATION_REGEX);
  if (donationMatch) {
    const [, province, amount, resource] = donationMatch;
    const value = parseInt(amount.replace(/,/g, ''), 10);
    return {
      type: 'donation',
      province,
      goldDonated: resource === 'gold coins' ? value : 0,
      bushelsDonated: resource === 'bushels' ? value : 0,
    };
  }

  const attackMatch = content.match(ATTACK_REGEX);
  if (attackMatch) {
    const [, province, troops, points] = attackMatch;
    return {
      type: 'attack',
      province,
      troopsSent: parseInt(troops.replace(/,/g, ''), 10),
      pointsWeakened: parseInt(points.replace(/,/g, ''), 10),
    };
  }

  return null;
}

module.exports = { parseMessage };
