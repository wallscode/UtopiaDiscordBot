// Admin-only answers to the two questions the bot also asks in its terminal:
// confirm a detected new age, and delete war data from old ages. Replies are
// only visible to the admin who ran the command.

const { SlashCommandBuilder } = require('discord.js');
const war = require('../war/context');
const { isAdmin } = require('./commandUtils');

const reply = (interaction, content) => interaction.reply({ content, ephemeral: true });

const ageConfirm = {
  data: new SlashCommandBuilder()
    .setName('age-confirm')
    .setDescription('Admin: confirm or reject a detected new Utopia age (no option = show status)')
    .addStringOption((o) =>
      o.setName('decision').setDescription('What to do with the detected age change')
        .addChoices(
          { name: 'confirm — start the new age', value: 'confirm' },
          { name: 'reject — it was a misread', value: 'reject' },
        ))
    .addIntegerOption((o) =>
      o.setName('age').setDescription('Number of the new age (defaults to current + 1)').setMinValue(1)),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) return reply(interaction, 'Only admins can change the age.');
    war.tick();
    const { ages } = war;
    const decision = interaction.options.getString('decision');
    if (!ages.pending) {
      return reply(interaction, `No age change is pending. Current age: ${ages.currentAge}.`);
    }
    if (!decision) {
      return reply(interaction, `${ages.describePending()}\nRun \`/age-confirm decision:confirm\` or \`decision:reject\`.`);
    }
    if (decision === 'reject') {
      ages.rejectAgeChange();
      console.log(`Age change rejected by ${interaction.user.tag} via /age-confirm.`);
      return reply(interaction, `Rejected. Still age ${ages.currentAge}; that clock reading will be ignored.`);
    }
    const age = ages.confirmAgeChange(interaction.options.getInteger('age') ?? undefined);
    console.log(`Age ${age} confirmed by ${interaction.user.tag} via /age-confirm.`);
    war.tick(); // war news that was waiting for the new age
    return reply(interaction, `Now in age ${age}. Run \`/provinces action:refresh\` once the new provinces have posted.`);
  },
};

const ageCleanup = {
  data: new SlashCommandBuilder()
    .setName('age-cleanup')
    .setDescription('Admin: delete war data from ages 3+ back (no option = show what is kept)')
    .addStringOption((o) =>
      o.setName('action').setDescription('What to do with old ages')
        .addChoices(
          { name: 'delete — remove old ages\' war data', value: 'delete' },
          { name: 'skip — don\'t ask again until next age', value: 'skip' },
        )),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) return reply(interaction, 'Only admins can delete war data.');
    const { ages } = war;
    const old = ages.oldAges();
    const action = interaction.options.getString('action');
    if (!old.length) return reply(interaction, `No war data from ages before ${ages.currentAge - 2} is kept.`);
    if (action === 'delete') {
      const removed = ages.deleteOldAges();
      console.log(`Old war data for age(s) ${removed.join(', ')} deleted by ${interaction.user.tag}.`);
      return reply(interaction, `Deleted war data for age(s) ${removed.join(', ')}.`);
    }
    if (action === 'skip') {
      ages.snoozeCleanup();
      return reply(interaction, `OK, no more reminders until age ${ages.currentAge + 1}. The data is kept.`);
    }
    return reply(interaction, `War data is kept for old age(s) ${old.join(', ')}. `
      + 'Use `action:delete` to remove it, or `action:skip` to stop reminders until next age.');
  },
};

module.exports = { ageConfirm, ageCleanup };
