const { SlashCommandBuilder } = require('discord.js');
const { getAll, getUpdatedAt } = require('../handlers/provinceStore');
const { scanProvinces } = require('../handlers/provinceScanner');

const ADMIN_ROLE_NAME = process.env.ADMIN_ROLE_NAME || 'Admin';

function isAdmin(member) {
  return member.roles.cache.some(
    (role) => role.name.toLowerCase() === ADMIN_ROLE_NAME.toLowerCase()
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('provinces')
    .setDescription('Display the province inventory')
    .addStringOption((option) =>
      option
        .setName('action')
        .setDescription('Use "refresh" to rebuild the province list (admin only)')
        .addChoices({ name: 'refresh', value: 'refresh' })
    ),

  async execute(interaction) {
    const action = interaction.options.getString('action');

    if (action === 'refresh') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: 'You do not have permission to refresh the province list.',
          ephemeral: true,
        });
      }

      await interaction.deferReply();
      const guild = interaction.guild;
      const count = await scanProvinces(guild);
      return interaction.editReply(`Province list rebuilt. ${count} provinces found.`);
    }

    // Default: display inventory
    const provinces = getAll();
    const updatedAt = getUpdatedAt();

    if (provinces.length === 0) {
      return interaction.reply(
        'No province inventory yet. Run `/provinces action:refresh` to build it.'
      );
    }

    const timestamp = updatedAt
      ? new Date(updatedAt).toUTCString()
      : 'unknown';

    const list = provinces.join('\n');
    const header = `Province Inventory — ${provinces.length} provinces (last updated: ${timestamp})\n\n`;
    const output = header + list;

    // Split if over 2000 chars
    if (output.length <= 2000) {
      return interaction.reply({ content: `\`\`\`\n${output}\n\`\`\`` });
    }

    await interaction.reply({ content: `\`\`\`\n${header}\`\`\`` });
    const chunks = [];
    let chunk = '';
    for (const p of provinces) {
      if ((chunk + p + '\n').length > 1900) {
        chunks.push(chunk);
        chunk = '';
      }
      chunk += p + '\n';
    }
    if (chunk) chunks.push(chunk);
    for (const c of chunks) {
      await interaction.followUp({ content: `\`\`\`\n${c}\`\`\`` });
    }
  },
};
