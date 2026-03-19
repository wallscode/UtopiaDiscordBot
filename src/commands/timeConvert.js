const { SlashCommandBuilder } = require('discord.js');

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july'];
const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July'];

// Each tick = 1 real hour.
// Ticks since the start of YR1 January 1:
//   (year - 1) * 168  +  monthIndex * 24  +  (day - 1)
function parseInGameDate(str) {
  const match = str.trim().match(/^(\w+)\s+(\d+)\s+of\s+YR(\d+)$/i);
  if (!match) return null;

  const monthIndex = MONTHS.indexOf(match[1].toLowerCase());
  if (monthIndex === -1) return null;

  const day = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (day < 1 || day > 24) return null;
  if (year < 1) return null;

  return { month: monthIndex, day, year };
}

function toTicks({ year, month, day }) {
  return (year - 1) * 168 + month * 24 + (day - 1);
}

function formatRealTime(date, timezone) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZoneName: 'short',
    }).format(date);
  } catch {
    return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('time-convert')
    .setDescription('Convert between in-game time and real-world time')
    .addStringOption((o) =>
      o.setName('current').setDescription('Current in-game date, e.g. "January 15 of YR5"').setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('target').setDescription('Target in-game date to convert, e.g. "January 8 of YR5"').setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('timezone').setDescription('Timezone for output, e.g. America/New_York (default: UTC)')
    ),

  async execute(interaction) {
    const currentStr = interaction.options.getString('current');
    const targetStr = interaction.options.getString('target');
    const timezone = interaction.options.getString('timezone') || 'UTC';

    const currentDate = parseInGameDate(currentStr);
    if (!currentDate) {
      return interaction.reply({
        content: `Could not parse current date: **${currentStr}**\nExpected format: \`Month Day of YRN\` (e.g. \`January 15 of YR5\`)`,
        ephemeral: true,
      });
    }

    const targetDate = parseInGameDate(targetStr);
    if (!targetDate) {
      return interaction.reply({
        content: `Could not parse target date: **${targetStr}**\nExpected format: \`Month Day of YRN\` (e.g. \`January 8 of YR5\`)`,
        ephemeral: true,
      });
    }

    const diffHours = toTicks(targetDate) - toTicks(currentDate);
    const targetRealMs = Date.now() + diffHours * 60 * 60 * 1000;
    const targetRealDate = new Date(targetRealMs);

    const utcStr = formatRealTime(targetRealDate, 'UTC');
    const tzStr = timezone !== 'UTC' ? formatRealTime(targetRealDate, timezone) : null;

    if (tzStr === null && timezone !== 'UTC') {
      return interaction.reply({
        content: `Unknown timezone: **${timezone}**\nUse an IANA timezone name like \`America/New_York\`, \`Europe/London\`, or \`Asia/Tokyo\`.`,
        ephemeral: true,
      });
    }

    const absDiff = Math.abs(diffHours);
    const direction = diffHours < 0 ? 'ago' : diffHours > 0 ? 'from now' : null;
    const offsetLabel = direction
      ? `${absDiff} hour${absDiff !== 1 ? 's' : ''} ${direction}`
      : 'same time as now';

    const targetLabel = `${MONTH_LABELS[targetDate.month]} ${targetDate.day} of YR${targetDate.year}`;

    const lines = [
      `Time Conversion: ${targetLabel}`,
      '-'.repeat(40),
      `Offset:   ${offsetLabel}`,
      `UTC:      ${utcStr}`,
    ];

    if (tzStr) {
      lines.push(`Local:    ${tzStr}`);
    }

    return interaction.reply({ content: `\`\`\`\n${lines.join('\n')}\n\`\`\`` });
  },
};
