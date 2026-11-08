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
    .setDescription('Per-province war summary: the current war, or the last one if not at war')
    .addStringOption((o) =>
      o.setName('opponent').setDescription('Look up an earlier war this age by enemy kingdom, e.g. 6:7'))
    .addStringOption((o) =>
      o.setName('province').setDescription('Show one province in full'))
    .addBooleanOption((o) =>
      o.setName('self_spells').setDescription('Include self-spells (off by default)')),

  async execute(interaction) {
    const opponent = interaction.options.getString('opponent')?.trim() || null;
    const province = interaction.options.getString('province');
    const includeSelfSpells = interaction.options.getBoolean('self_spells') ?? false;

    if (opponent && !OPPONENT_RE.test(opponent)) {
      return interaction.reply({
        content: `"${opponent}" isn't a kingdom location. Use the form N:N, e.g. \`6:7\`.`,
        ephemeral: true,
      });
    }

    war.tick();
    let shown;
    let otherWars = 0;
    if (opponent) {
      const wars = war.warStore.findWars(opponent);
      if (!wars.length) {
        return interaction.reply({
          content: `${war.pendingBanner()}No war vs ${opponent} recorded in age ${war.ages.currentAge}.`,
          ephemeral: true,
        });
      }
      [shown] = wars;
      otherWars = wars.length - 1;
    } else {
      shown = war.warStore.latestWar();
      if (!shown) {
        return interaction.reply({ content: `${war.pendingBanner()}No wars recorded yet.`, ephemeral: true });
      }
    }
    const summary = summarize([shown], { includeSelfSpells, knownProvinces: getProvinces() });
    const text = formatWarReport({
      war: shown,
      window: war.warStore.window(shown),
      summary,
      age: shown.age,
      province,
      includeSelfSpells,
      otherWars,
    });
    await sendChunked(interaction, war.pendingBanner() + text);
  },
};
