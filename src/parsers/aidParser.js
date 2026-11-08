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

// `line` is the event's line number within the message, a stable identity
// for the event (see war/eventLog.js).
function parseAidMessage(content, timestamp) {
  const results = [];
  content.split('\n').forEach((line, i) => {
    const event = parseAidLine(line.trim());
    if (event) results.push({ ...event, line: i, timestamp });
  });
  return results;
}

module.exports = { parseAidMessage };
