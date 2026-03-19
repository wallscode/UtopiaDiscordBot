function formatNum(n) {
  return n.toLocaleString('en-US');
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

module.exports = { formatNum, periodLabel, sendChunked };
