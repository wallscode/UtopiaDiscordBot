const { SlashCommandBuilder } = require('discord.js');
const { generateDragonReport, generateForumReport, generateMobileForumReport } = require('../reports/dragonReport');
const { lookupWar } = require('../war/warLookup');
const { summarizeDragons } = require('../war/warSummary');
const { warRange } = require('../war/reportFormat');
const { splitForDiscord } = require('./commandUtils');

// Totals and title for one war, from its stored record: donations and dragon
// attacks inside the war (which ends at the tick starting the post-war
// notice's day, so troops dumped on a dragon after the war don't count), plus
// donations from up to 48 hours before it.
function warSource(war) {
  const { provinces } = summarizeDragons([war]);
  const entries = [...provinces.values()].map(({ name, ...totals }) => ({ province: name, ...totals }));
  const preWar = (war.events || []).some((e) => e.kind === 'dragon' && e.preWar);
  const running = war.ended ? '' : ', so far';
  return {
    entries,
    label: ` — war vs ${war.opponent} (${warRange(war)}${running})`
      + (preWar ? ' incl. donations up to 48h before the war' : ''),
  };
}

module.exports = {
  warSource,
  data: new SlashCommandBuilder()
    .setName('dragon-stats')
    .setDescription('Display the Dragon Summary report')
    .addStringOption((option) =>
      option
        .setName('format')
        .setDescription('Output format')
        .addChoices(
          { name: 'discord', value: 'discord' },
          { name: 'forum', value: 'forum' },
          { name: 'mobile-forum', value: 'mobile-forum' }
        )
    )
    .addStringOption((o) =>
      o.setName('war').setDescription('A war: "current" (running or last) or the enemy kingdom, e.g. 6:7'))
    .addIntegerOption((o) =>
      o.setName('period').setDescription('Only include data from the last N hours (default: all time)').setMinValue(1)
    ),

  async execute(interaction) {
    const format = interaction.options.getString('format') ?? 'discord';
    const period = interaction.options.getInteger('period') ?? null;
    const warArg = interaction.options.getString('war');

    let source;
    if (warArg) {
      if (period) {
        return interaction.reply({ content: 'Use either `war` or `period`, not both.', ephemeral: true });
      }
      const found = lookupWar(warArg);
      if (found.error) return interaction.reply({ content: found.error, ephemeral: true });
      source = warSource(found.war);
    }

    // Long reports (many provinces) are split to fit Discord's limit.
    const messages = splitForDiscord(
      format === 'forum' ? generateForumReport(period, source) :
      format === 'mobile-forum' ? generateMobileForumReport(period, source) :
      generateDragonReport(period, source));

    await interaction.reply({ content: messages[0] });
    for (let i = 1; i < messages.length; i++) {
      await interaction.followUp({ content: messages[i] });
    }
  },
};
