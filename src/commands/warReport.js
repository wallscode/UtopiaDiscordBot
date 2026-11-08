const { SlashCommandBuilder } = require('discord.js');
const war = require('../war/context');
const { summarize } = require('../war/warSummary');
const { formatWarReport } = require('../war/reportFormat');
const { OPPONENT_RE } = require('../war/warStore');
const { getAll: getProvinces } = require('../handlers/provinceStore');
const { sendChunked } = require('./commandUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('war-report')
    .setDescription('Per-province summary of a war this age: Kingdom News hits plus #attacks and #tm-ops')
    .addStringOption((o) =>
      o.setName('opponent').setDescription('Enemy kingdom, e.g. 6:7').setRequired(true))
    .addStringOption((o) =>
      o.setName('province').setDescription('Show one province in full'))
    .addBooleanOption((o) =>
      o.setName('self_spells').setDescription('Include self-spells (off by default)')),

  async execute(interaction) {
    const opponent = interaction.options.getString('opponent').trim();
    const province = interaction.options.getString('province');
    const includeSelfSpells = interaction.options.getBoolean('self_spells') ?? false;

    if (!OPPONENT_RE.test(opponent)) {
      return interaction.reply({
        content: `"${opponent}" isn't a kingdom location. Use the form N:N, e.g. \`6:7\`.`,
        ephemeral: true,
      });
    }

    war.tick();
    const wars = war.warStore.findWars(opponent);
    if (!wars.length) {
      return interaction.reply({
        content: `${war.pendingBanner()}No war vs ${opponent} recorded in age ${war.ages.currentAge}.`,
        ephemeral: true,
      });
    }
    const latest = wars[0];
    const summary = summarize([latest], { includeSelfSpells, knownProvinces: getProvinces() });
    const text = formatWarReport({
      war: latest,
      window: war.warStore.window(latest),
      summary,
      age: war.ages.currentAge,
      province,
      includeSelfSpells,
      otherWars: wars.length - 1,
    });
    await sendChunked(interaction, war.pendingBanner() + text);
  },
};
