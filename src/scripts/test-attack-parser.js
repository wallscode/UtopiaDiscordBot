const fs = require('fs');
const path = require('path');
const { parseAttackMessage } = require('../parsers/attackParser');

const dumpPath = path.join(__dirname, '../../data/channel-dumps/attackers.json');
const messages = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

const botMessages = messages.filter((m) => m.author === 'utopiabot' || m.author?.username === 'utopiabot');
console.log(`Total utopiabot messages: ${botMessages.length}`);

let parsed = 0;
let failed = 0;
const failedSamples = [];

for (const msg of botMessages) {
  const events = parseAttackMessage(msg.content, new Date().toISOString());
  if (events.length > 0) {
    parsed += events.length;
  } else {
    failed++;
    if (failedSamples.length < 5) failedSamples.push(msg.content);
  }
}

console.log(`Parsed:  ${parsed} attacks`);
console.log(`Failed:  ${failed} messages produced no events`);

if (failedSamples.length > 0) {
  console.log('\nFailed message samples (raw):');
  for (const s of failedSamples) {
    console.log(JSON.stringify(s));
  }
}

const sample = botMessages[0];
if (sample) {
  console.log('\nFirst message raw (JSON.stringify to show all chars):');
  console.log(JSON.stringify(sample.content));
  const events = parseAttackMessage(sample.content, new Date().toISOString());
  console.log('Parsed result:', JSON.stringify(events[0], null, 2));
}
