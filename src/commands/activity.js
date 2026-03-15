const { SlashCommandBuilder } = require('discord.js');
const { getAll, getProvince } = require('../handlers/activityStore');
const { getAll: getProvinces } = require('../handlers/provinceStore');

function hoursAgo(isoTimestamp) {
  return Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / (1000 * 60 * 60));
}

function formatTimestamp(isoTimestamp) {
  return new Date(isoTimestamp).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

function buildReport(entries, nameWidth) {
  const lines = [
    'Province Activity (last seen)',
    '-'.repeat(60),
  ];

  for (const { province, timestamp, action } of entries) {
    const hours = hoursAgo(timestamp);
    const name = province.padEnd(nameWidth);
    const ts = formatTimestamp(timestamp);
    lines.push(`${name}  ${ts}  [${action}]  ${hours}h ago`);
  }

  return lines.join('\n');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('activity')
    .setDescription('Show the last seen activity for each province')
    .addStringOption((option) =>
      option.setName('province').setDescription('Show activity for a single province')
    )
    .addIntegerOption((option) =>
      option
        .setName('hours')
        .setDescription('Only show provinces inactive for more than this many hours')
        .setMinValue(1)
    ),

  async execute(interaction) {
    const provinceName = interaction.options.getString('province');
    const hoursFilter = interaction.options.getInteger('hours');

    // Single province lookup
    if (provinceName) {
      const entry = getProvince(provinceName);
      if (!entry) {
        return interaction.reply(`No activity found for **${provinceName}**.`);
      }
      const hours = hoursAgo(entry.timestamp);
      const ts = formatTimestamp(entry.timestamp);
      return interaction.reply(
        `\`\`\`\n${entry.province}\nLast seen: ${ts}  [${entry.action}]  ${hours}h ago\n\`\`\``
      );
    }

    // Build full list — merge with province inventory so all provinces appear
    const activityMap = new Map(getAll().map((e) => [e.province.toLowerCase(), e]));
    const allProvinces = getProvinces();

    let entries = allProvinces.map((name) =>
      activityMap.get(name.toLowerCase()) ?? { province: name, timestamp: null, action: 'no data' }
    );

    // Also include any active provinces not in the inventory
    for (const entry of getAll()) {
      if (!allProvinces.some((p) => p.toLowerCase() === entry.province.toLowerCase())) {
        entries.push(entry);
      }
    }

    // Apply hours filter (inactive for MORE than N hours, or no data)
    if (hoursFilter) {
      entries = entries.filter(
        (e) => !e.timestamp || hoursAgo(e.timestamp) > hoursFilter
      );
    }

    // Sort: no data last, then oldest first (most inactive at top)
    entries.sort((a, b) => {
      if (!a.timestamp && !b.timestamp) return a.province.localeCompare(b.province);
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      return new Date(a.timestamp) - new Date(b.timestamp);
    });

    if (entries.length === 0) {
      const msg = hoursFilter
        ? `No provinces have been inactive for more than ${hoursFilter} hours.`
        : 'No activity data found. Run the bot to backfill.';
      return interaction.reply(msg);
    }

    const nameWidth = Math.max(...entries.map((e) => e.province.length)) + 2;
    const report = buildReport(entries, nameWidth);

    // Split into chunks if needed
    const lines = report.split('\n');
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
  },
};
