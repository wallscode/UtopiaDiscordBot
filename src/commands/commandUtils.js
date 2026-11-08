const ADMIN_ROLE_NAME = process.env.ADMIN_ROLE_NAME || 'Admin';

function isAdmin(member) {
  return Boolean(member?.roles?.cache?.some(
    (role) => role.name.toLowerCase() === ADMIN_ROLE_NAME.toLowerCase()
  ));
}

function formatNum(n) {
  return n.toLocaleString('en-US');
}

function formatAvg(n) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function periodLabel(hours) {
  if (!hours) return '';
  return ` (last ${hours}h)`;
}

async function sendChunked(interaction, text) {
  const lines = text.split('\n');
  const chunks = [];
  let chunk = '';
  for (const line of lines) {
    if ((chunk + line + '\n').length > 1900) {
      chunks.push(chunk);
      chunk = '';
    }
    chunk += line + '\n';
  }
  if (chunk) chunks.push(chunk);

  await interaction.reply({ content: `\`\`\`\n${chunks[0]}\`\`\`` });
  for (let i = 1; i < chunks.length; i++) {
    await interaction.followUp({ content: `\`\`\`\n${chunks[i]}\`\`\`` });
  }
}

const DISCORD_LIMIT = 2000;

// Split prepared messages so none exceeds Discord's 2,000-character limit.
// Splits between lines; a ``` code block cut in two is closed at the end of
// one message and reopened at the start of the next, and so is a <pre> block
// (the mobile-forum format), which is split at its <br> line breaks.
function splitForDiscord(messages, limit = DISCORD_LIMIT) {
  const out = [];
  for (const message of messages) {
    if (message.length <= limit) {
      out.push(message);
      continue;
    }
    // Break over-long lines (a <pre> block joined with <br>) into pieces.
    const lines = [];
    for (const line of message.split('\n')) {
      if (line.length <= limit - 20) { lines.push(line); continue; }
      const parts = line.split('<br>');
      let piece = '';
      for (const part of parts) {
        const next = piece ? `${piece}<br>${part}` : part;
        if (next.length > limit - 20 && piece) {
          lines.push(piece);
          piece = part;
        } else {
          piece = next;
        }
      }
      if (piece) lines.push(piece);
    }
    let chunk = [];
    let inCode = false;   // inside a ``` block
    let inPre = false;    // inside a <pre> block
    const close = () => [...(inPre ? ['</pre>'] : []), ...(inCode ? ['```'] : [])];
    const reopen = () => [...(inCode ? ['```'] : []), ...(inPre ? ['<pre>'] : [])];
    const size = (arr) => arr.join('\n').length;
    for (const line of lines) {
      if (chunk.length && size([...chunk, line, ...close()]) > limit) {
        out.push([...chunk, ...close()].join('\n'));
        chunk = reopen();
      }
      chunk.push(line);
      if (line.trim().startsWith('```')) inCode = !inCode;
      const opens = (line.match(/<pre>/g) || []).length;
      const closes = (line.match(/<\/pre>/g) || []).length;
      if (opens !== closes) inPre = opens > closes;
    }
    if (chunk.length) out.push(chunk.join('\n'));
  }
  return out;
}

module.exports = { formatNum, formatAvg, periodLabel, sendChunked, isAdmin, splitForDiscord };
