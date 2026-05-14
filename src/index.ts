import { Events, type ChatInputCommandInteraction } from 'discord.js';
import { createClient, registerCommands, type CommandHandler } from './discord.js';
import { Rotation } from './rotation.js';
import { SpotifyClient } from './spotify.js';
import { Poller } from './poller.js';
import { createServer } from './server.js';
import { joinCommand } from './commands/join.js';
import { leaveCommand } from './commands/leave.js';
import { addCommand } from './commands/add.js';
import { removeCommand } from './commands/remove.js';
import { queueCommand } from './commands/queue.js';
import { nowCommand } from './commands/now.js';
import { skipCommand } from './commands/skip.js';
import { djsCommand } from './commands/djs.js';
import { startJamCommand } from './commands/start-jam.js';
import { stopJamCommand } from './commands/stop-jam.js';

const required = (name: string): string => {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env var: ${name}`);
  return val;
};

async function main() {
  const discordToken = required('DISCORD_TOKEN');
  const discordClientId = required('DISCORD_CLIENT_ID');
  const spotifyClientId = required('SPOTIFY_CLIENT_ID');
  const spotifyClientSecret = required('SPOTIFY_CLIENT_SECRET');
  const spotifyRefreshToken = required('SPOTIFY_REFRESH_TOKEN');
  const port = parseInt(process.env.PORT ?? '3000', 10);

  const rotation = new Rotation();
  const spotify = new SpotifyClient(spotifyClientId, spotifyClientSecret, spotifyRefreshToken);
  const client = createClient();
  const poller = new Poller(rotation, spotify, client);

  const commands: Record<string, CommandHandler> = {
    join: joinCommand(rotation),
    leave: leaveCommand(rotation),
    add: addCommand(rotation, spotify, { isJamActive: () => poller.isActive(), onFirstTrack: () => poller.playNext().then(() => {}) }),
    remove: removeCommand(rotation),
    queue: queueCommand(rotation),
    now: nowCommand(rotation, spotify),
    skip: skipCommand(rotation, { onSkip: () => poller.playNext().then(() => {}) }),
    djs: djsCommand(rotation),
    'start-jam': startJamCommand(spotify, {
      onStarted: (channelId) => { poller.setChannel(channelId); poller.start(); },
    }),
    'stop-jam': stopJamCommand(rotation, spotify, {
      onStopped: () => { poller.stop(); },
    }),
  };

  client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {
      const handler = commands[interaction.commandName];
      if (handler) {
        try {
          await handler(interaction as ChatInputCommandInteraction);
        } catch (err) {
          console.error(`Command error (${interaction.commandName}):`, err);
          try {
            const reply = { content: 'Something went wrong.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
              await interaction.followUp(reply);
            } else {
              await interaction.reply(reply);
            }
          } catch {}
        }
      }
    }

    if (interaction.isButton()) {
      const current = rotation.getCurrentTrack();
      if (!current) return;

      if (interaction.customId === 'vote_fire') {
        const added = rotation.voteFire(interaction.user.id);
        const votes = rotation.getVotes();
        await interaction.reply({
          content: added
            ? `🔥 ${interaction.user.displayName} likes this! (${votes.fire} 🔥)`
            : 'You already voted!',
          ephemeral: !added,
        });
      }

      if (interaction.customId === 'vote_skip') {
        const shouldSkip = rotation.voteSkip(interaction.user.id);
        const votes = rotation.getVotes();
        const needed = Math.floor(rotation.getDJs().length / 2) + 1;

        if (shouldSkip) {
          await interaction.reply(`⏭️ Skipped **${current.title}** (${votes.skip}/${needed} votes)`);
          await poller.playNext();
        } else {
          await interaction.reply(`👎 ${interaction.user.displayName} voted to skip (${votes.skip}/${needed} needed)`);
        }
      }
    }
  });

  client.once(Events.ClientReady, async c => {
    console.log(`Logged in as ${c.user.tag}`);
  });

  await registerCommands(discordClientId, discordToken);
  await client.login(discordToken);

  createServer(spotifyClientId, spotifyClientSecret, port);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
