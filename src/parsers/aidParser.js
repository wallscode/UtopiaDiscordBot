// :moneybag: Sender [code#] sent __amount resource__ to Receiver [code]
const RESOURCE_MAP = {
  'gold coins': 'gold',
  'bushels': 'bushels',
  'soldiers': 'soldiers',
  'runes': 'runes',
};

const AID_REGEX = /:moneybag: (.+?) \[.+?\] sent ([\d,]+) (.+?) to (.+?) \[/;

function clean(content) {
  return content.replace(/__/g, '').replace(/\*\*/g, '');
}

function parseAidLine(line) {
  const cleaned = clean(line);
  const match = cleaned.match(AID_REGEX);
  if (!match) return null;

  const [, sender, amountStr, resourceRaw, receiver] = match;
  const resource = RESOURCE_MAP[resourceRaw.trim()] ?? resourceRaw.trim();
  const amount = parseInt(amountStr.replace(/,/g, ''), 10);

  return { sender: sender.trim(), receiver: receiver.trim(), resource, amount };
}

function parseAidMessage(content, timestamp) {
  const results = [];
  for (const line of content.split('\n')) {
    const event = parseAidLine(line.trim());
    if (event) results.push({ ...event, timestamp });
  }
  return results;
}

module.exports = { parseAidMessage };
