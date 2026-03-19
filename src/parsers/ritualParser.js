// :pray:__RITUAL__ Province [code#] cast a ritual! (N casts performed!)

const RITUAL_REGEX = /RITUAL (.+?) \[.+?\] cast a ritual! \((\d+) casts/;

function clean(content) {
  return content.replace(/__/g, '').replace(/\*\*/g, '');
}

function parseRitualLine(line) {
  const match = clean(line).match(RITUAL_REGEX);
  if (!match) return null;
  return { province: match[1].trim(), castCount: parseInt(match[2], 10) };
}

function parseRitualMessage(content, timestamp) {
  const results = [];
  for (const line of content.split('\n')) {
    const event = parseRitualLine(line.trim());
    if (event) results.push({ ...event, timestamp });
  }
  return results;
}

module.exports = { parseRitualMessage };
