const { SlashCommandBuilder } = require('discord.js');
const { generateDragonReport } = require('../reports/dragonReport');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dragon')
    .setDescription('Display the Dragon Summary report'),

  async execute(interaction) {
    const messages = generateDragonReport();
    await interaction.reply({ content: messages[0] });
    for (let i = 1; i < messages.length; i++) {
      await interaction.followUp({ content: messages[i] });
    }
  },
};
