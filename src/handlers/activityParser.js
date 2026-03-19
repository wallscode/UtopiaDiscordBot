const { getAll: getProvinces } = require('./provinceStore');

// Bracket-based patterns for channels where province precedes [shortcode#]
const BRACKET_PATTERNS = {
  dragons: [
    { regex: /DRAGON (.+?) \[/, action: 'dragon donation' },
    { regex: /DRAGON (.+?) \[.+?\] sent/, action: 'dragon attack' },
  ],
  aid: [
    { regex: /:moneybag: (.+?) \[/, action: 'sent aid' },
  ],
  attackers: [
    { regex: /:crossed_swords: (.+?) \[/, action: 'military attack' },
  ],
  ritual: [
    { regex: /RITUAL (.+?) \[/, action: 'cast ritual' },
  ],
};

// For tms and general, province name is not in brackets — use inventory lookup
const INVENTORY_PATTERNS = {
  tms: [
    { prefix: /:detective::[a-z_]+: /, action: 'espionage' },
    { prefix: /:comet::[a-z_]+: /, action: 'cast spell' },
  ],
  general: [
    { prefix: /:star2::[a-z_]+: /, action: 'cast self-spell' },
  ],
};

function clean(content) {
  return content.replace(/__/g, '').replace(/\*\*/g, '');
}

// Match province name at start of text using inventory (longest match first)
function matchProvinceAtStart(text) {
  const provinces = getProvinces();
  const sorted = [...provinces].sort((a, b) => b.length - a.length);
  for (const p of sorted) {
    if (text.toLowerCase().startsWith(p.toLowerCase())) {
      return p;
    }
  }
  return null;
}

// Returns array of { province, action } extracted from a single message line
function parseLine(line, channelName) {
  const cleaned = clean(line);
  const results = [];

  // Bracket-based extraction
  const bracketPatterns = BRACKET_PATTERNS[channelName];
  if (bracketPatterns) {
    for (const { regex, action } of bracketPatterns) {
      const match = cleaned.match(regex);
      if (match) {
        results.push({ province: match[1].trim(), action });
        break;
      }
    }
    return results;
  }

  // Inventory-based extraction
  const inventoryPatterns = INVENTORY_PATTERNS[channelName];
  if (inventoryPatterns) {
    for (const { prefix, action } of inventoryPatterns) {
      const prefixMatch = cleaned.match(prefix);
      if (prefixMatch) {
        const afterPrefix = cleaned.slice(prefixMatch.index + prefixMatch[0].length);
        const province = matchProvinceAtStart(afterPrefix);
        if (province) {
          results.push({ province, action });
        }
        break;
      }
    }
  }

  return results;
}

// Returns array of { province, action } from a full (possibly multi-line) message
function parseMessage(content, channelName) {
  const lines = content.split('\n');
  const results = [];
  for (const line of lines) {
    const found = parseLine(line.trim(), channelName);
    results.push(...found);
  }
  return results;
}

module.exports = { parseMessage };
