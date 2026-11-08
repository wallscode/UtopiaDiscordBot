const { SlashCommandBuilder } = require('discord.js');
const war = require('../war/context');
const { summarize } = require('../war/warSummary');
const { formatAgeReport } = require('../war/reportFormat');
const { getAll: getProvinces } = require('../handlers/provinceStore');
const { sendChunked } = require('./commandUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('age-report')
    .setDescription('Kingdom summary of every war in the age: the current age, or an earlier one')
    .addIntegerOption((o) =>
      o.setName('age').setDescription('An earlier age number, e.g. 116 (default: the current age)').setMinValue(1))
    .addStringOption((o) =>
      o.setName('province').setDescription('Show one province in full'))
    .addBooleanOption((o) =>
      o.setName('self_spells').setDescription('Include self-spells (off by default)')),

  async execute(interaction) {
    const province = interaction.options.getString('province');
    const includeSelfSpells = interaction.options.getBoolean('self_spells') ?? false;

    war.tick();
    const currentAge = war.ages.currentAge;
    const age = interaction.options.getInteger('age') ?? currentAge;
    const wars = war.warStore.listWars(age);
    if (!wars.length) {
      const kept = war.warStore.listAges().filter((a) => war.warStore.listWars(a).length);
      return interaction.reply({
        content: `${war.pendingBanner()}No wars recorded in age ${age}`
          + (age === currentAge ? ' yet.' : '.')
          + (kept.length ? ` Ages with war data: ${kept.join(', ')}.` : ''),
        ephemeral: true,
      });
    }
    // Province names change every age, so the current list only helps now.
    const knownProvinces = age === currentAge ? getProvinces() : [];
    const perWar = wars.map((w) => summarize([w], { knownProvinces }));
    const summary = summarize(wars, { includeSelfSpells, knownProvinces });
    const text = formatAgeReport({
      age,
      wars,
      windows: wars.map((w) => war.warStore.window(w)),
      perWar,
      summary,
      province,
      includeSelfSpells,
      current: age === currentAge,
    });
    await sendChunked(interaction, war.pendingBanner() + text);
  },
};
