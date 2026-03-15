require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const DUMP_DIR = path.join(__dirname, '../../data/channel-dumps');
const DISCORD_EPOCH = 1420070400000n;

function timestampToSnowflake(ms) {
  return String((BigInt(ms) - DISCORD_EPOCH) << 22n);
}

async function dumpChannel(channel, cutoffMs) {
  const messages = [];
  const afterId = timestampToSnowflake(cutoffMs);
  let lastFetchedId = afterId;

  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, after: lastFetchedId });
    if (batch.size === 0) break;

    const sorted = [...batch.values()].sort(
      (a, b) => Number(BigInt(a.id) - BigInt(b.id))
    );

    for (const msg of sorted) {
      messages.push({
        id: msg.id,
        author: msg.author.username,
        content: msg.content,
        timestamp: msg.createdAt.toISOString(),
      });
    }

    lastFetchedId = sorted[sorted.length - 1].id;
    if (batch.size < 100) break;
  }

  return messages;
}

async function main() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once('clientReady', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    if (!fs.existsSync(DUMP_DIR)) fs.mkdirSync(DUMP_DIR, { recursive: true });

    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) {
      console.error('Guild not found.');
      client.destroy();
      return;
    }

    const cutoffMs = Date.now() - TWO_WEEKS_MS;
    const textChannels = guild.channels.cache.filter((c) => c.isTextBased() && !c.isThread());

    console.log(`Found ${textChannels.size} text channels. Dumping messages from the last 2 weeks...\n`);

    for (const [, channel] of textChannels) {
      process.stdout.write(`  #${channel.name}... `);
      try {
        const messages = await dumpChannel(channel, cutoffMs);
        const outFile = path.join(DUMP_DIR, `${channel.name}.json`);
        fs.writeFileSync(outFile, JSON.stringify(messages, null, 2));
        console.log(`${messages.length} messages saved.`);
      } catch (err) {
        console.log(`skipped (${err.message})`);
      }
    }

    console.log(`\nDone. Files written to data/channel-dumps/`);
    client.destroy();
  });

  await client.login(process.env.DISCORD_TOKEN);
}

main();
