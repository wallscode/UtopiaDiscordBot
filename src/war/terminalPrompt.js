// Yes/no questions in the terminal the bot was started from, for the two
// decisions that change stored data: confirming a new age, and deleting old
// ages. Only asked when stdin is a real terminal (not under nodemon or a
// service manager). The admin slash commands /age-confirm and /age-cleanup do
// the same thing from Discord, so either answer works; whichever comes second
// finds nothing left to do.

const readline = require('readline');

let busy = false;
const queue = [];

function canAsk() {
  return Boolean(process.stdin.isTTY);
}

function ask(question) {
  return new Promise((resolve) => {
    queue.push({ question, resolve });
    drain();
  });
}

function drain() {
  if (busy || !queue.length) return;
  busy = true;
  const { question, resolve } = queue.shift();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  // readline swallows Ctrl+C while a question is open; let it stop the bot.
  rl.on('SIGINT', () => {
    rl.close();
    process.kill(process.pid, 'SIGINT');
  });
  rl.question(`\n${question}`, (answer) => {
    rl.close();
    busy = false;
    resolve(answer.trim().toLowerCase());
    drain();
  });
}

async function promptAgeChange(ages) {
  const text = ages.describePending();
  if (!text) return;
  if (!canAsk()) {
    console.warn(`\n*** ${text}\n*** Confirm or reject it with /age-confirm in Discord (admins only).\n`);
    return;
  }
  const answer = await ask(`*** ${text}\nStart age ${ages.pending.proposedAge} now? `
    + '[y]es / [n]o, it was a misread / anything else to decide later (or use /age-confirm): ');
  if (!ages.pending) return console.log('Already answered from Discord.');
  if (answer === 'y' || answer === 'yes') {
    const age = ages.confirmAgeChange();
    console.log(`Now in age ${age}. Run /provinces action:refresh once the new provinces have posted.`);
  } else if (answer === 'n' || answer === 'no') {
    ages.rejectAgeChange();
    console.log('Age change rejected; that clock reading will be ignored.');
  } else {
    console.log('Left pending. Answer later with /age-confirm, or at the next bot start.');
  }
}

async function promptCleanup(ages) {
  if (!ages.needsCleanupPrompt()) return;
  const list = ages.oldAges().join(', ');
  const text = `War data is still kept for old age(s) ${list} (current age ${ages.currentAge}).`;
  if (!canAsk()) {
    console.warn(`\n*** ${text} Use /age-cleanup in Discord to delete it or stop asking until next age.\n`);
    return;
  }
  const answer = await ask(`*** ${text}\n[d]elete it / [s]kip and don't ask again until next age / `
    + 'anything else to ask next start: ');
  if (!ages.needsCleanupPrompt()) return console.log('Already answered from Discord.');
  if (answer === 'd' || answer === 'delete') {
    console.log(`Deleted war data for age(s) ${ages.deleteOldAges().join(', ')}.`);
  } else if (answer === 's' || answer === 'skip') {
    ages.snoozeCleanup();
    console.log(`Won't ask again until age ${ages.currentAge + 1}.`);
  }
}

module.exports = { promptAgeChange, promptCleanup, canAsk };
