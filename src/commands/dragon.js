const { SlashCommandBuilder } = require('discord.js');
const { generateDragonReport, generateForumReport, generateMobileForumReport } = require('../reports/dragonReport');

module.exports = {
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
    .addIntegerOption((o) =>
      o.setName('period').setDescription('Only include data from the last N hours (default: all time)').setMinValue(1)
    ),

  async execute(interaction) {
    const format = interaction.options.getString('format') ?? 'discord';
    const period = interaction.options.getInteger('period') ?? null;
    const messages =
      format === 'forum' ? generateForumReport(period) :
      format === 'mobile-forum' ? generateMobileForumReport(period) :
      generateDragonReport(period);

    await interaction.reply({ content: messages[0] });
    for (let i = 1; i < messages.length; i++) {
      await interaction.followUp({ content: messages[i] });
    }
  },
};
