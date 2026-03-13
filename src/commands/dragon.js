const { SlashCommandBuilder } = require('discord.js');
const { generateDragonReport, generateForumReport } = require('../reports/dragonReport');

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
          { name: 'forum', value: 'forum' }
        )
    ),

  async execute(interaction) {
    const format = interaction.options.getString('format') ?? 'discord';
    const messages = format === 'forum' ? generateForumReport() : generateDragonReport();

    await interaction.reply({ content: messages[0] });
    for (let i = 1; i < messages.length; i++) {
      await interaction.followUp({ content: messages[i] });
    }
  },
};
