const { SlashCommandBuilder } = require('discord.js');
const war = require('../war/context');
const { summarize } = require('../war/warSummary');
const { formatAgeReport } = require('../war/reportFormat');
const { getAll: getProvinces } = require('../handlers/provinceStore');
const { sendChunked } = require('./commandUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('age-report')
    .setDescription('Per-province summary of every war in the current age')
    .addStringOption((o) =>
      o.setName('province').setDescription('Show one province in full'))
    .addBooleanOption((o) =>
      o.setName('self_spells').setDescription('Include self-spells (off by default)')),

  async execute(interaction) {
    const province = interaction.options.getString('province');
    const includeSelfSpells = interaction.options.getBoolean('self_spells') ?? false;

    war.tick();
    const wars = war.warStore.listWars();
    const age = war.ages.currentAge;
    if (!wars.length) {
      return interaction.reply({
        content: `${war.pendingBanner()}No wars recorded in age ${age} yet.`,
        ephemeral: true,
      });
    }
    const knownProvinces = getProvinces();
    const perWar = wars.map((w) => summarize([w], { knownProvinces }));
    const summary = summarize(wars, { includeSelfSpells, knownProvinces });
    const text = formatAgeReport({ age, wars, perWar, summary, province, includeSelfSpells });
    await sendChunked(interaction, war.pendingBanner() + text);
  },
};
