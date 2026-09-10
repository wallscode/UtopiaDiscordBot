const { SlashCommandBuilder } = require('discord.js');
const { getAll, getUpdatedAt, addProvince, removeProvince } = require('../handlers/provinceStore');
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
    .setDescription('Display and manage the province inventory')
    .addStringOption((option) =>
      option
        .setName('action')
        .setDescription('Action to perform')
        .addChoices(
          { name: 'refresh', value: 'refresh' },
          { name: 'add', value: 'add' },
          { name: 'remove', value: 'remove' }
        )
    )
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('Province name (required for add/remove)')
    ),

  async execute(interaction) {
    const action = interaction.options.getString('action');
    const name = interaction.options.getString('name');

    // --- ADD ---
    if (action === 'add') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({ content: 'You do not have permission to add provinces.', ephemeral: true });
      }
      if (!name) {
        return interaction.reply({ content: 'Please provide a province name: `/provinces action:add name:Province Name`', ephemeral: true });
      }
      const added = addProvince(name);
      return interaction.reply(
        added
          ? `Added province: **${name}**\nNote: manual additions are cleared by the next \`/provinces action:refresh\`.`
          : `**${name}** is already in the inventory.`
      );
    }

    // --- REMOVE ---
    if (action === 'remove') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({ content: 'You do not have permission to remove provinces.', ephemeral: true });
      }
      if (!name) {
        return interaction.reply({ content: 'Please provide a province name: `/provinces action:remove name:Province Name`', ephemeral: true });
      }
      const removed = removeProvince(name);
      return interaction.reply(
        removed
          ? `Removed province: **${name}**\nNote: refresh rebuilds the list from history, so this province returns if it is still active.`
          : `**${name}** was not found in the inventory.`
      );
    }

    // --- REFRESH ---
    if (action === 'refresh') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({ content: 'You do not have permission to refresh the province list.', ephemeral: true });
      }
      await interaction.deferReply();
      const { count, unresolved } = await scanProvinces(interaction.guild);
      let reply = `Province list rebuilt. ${count} provinces found.`;
      if (unresolved.length) {
        const shown = unresolved.slice(0, 10);
        reply += `\n\nCould not identify ${unresolved.length} entr${unresolved.length === 1 ? 'y' : 'ies'} ` +
          `(custom nickname, province name is the leading part). Add manually if missing:\n` +
          `\`\`\`\n${shown.join('\n')}\n\`\`\``;
        if (unresolved.length > shown.length) {
          reply += `…and ${unresolved.length - shown.length} more (see bot log).`;
        }
      }
      return interaction.editReply(reply);
    }

    // --- DEFAULT: list ---
    const provinces = getAll();
    const updatedAt = getUpdatedAt();

    if (provinces.length === 0) {
      return interaction.reply('No province inventory yet. Run `/provinces action:refresh` to build it.');
    }

    const timestamp = updatedAt ? new Date(updatedAt).toUTCString() : 'unknown';
    const header = `Province Inventory — ${provinces.length} provinces (last updated: ${timestamp})\n\n`;
    const list = provinces.join('\n');
    const output = header + list;

    if (output.length <= 1900) {
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
