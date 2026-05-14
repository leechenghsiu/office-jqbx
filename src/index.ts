import { Events, type ChatInputCommandInteraction } from 'discord.js';
import { createClient, registerCommands, type CommandHandler } from './discord.js';
import { SpotifyClient } from './spotify.js';
import { createServer } from './server.js';
import { addCommand } from './commands/add.js';
import { addArtistCommand } from './commands/add-artist.js';
import { addPlaylistCommand } from './commands/add-playlist.js';
import { queueCommand } from './commands/queue.js';
import { nowCommand } from './commands/now.js';
import { skipCommand } from './commands/skip.js';
import { startJamCommand } from './commands/start-jam.js';
import { stopJamCommand } from './commands/stop-jam.js';

const required = (name: string): string => {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env var: ${name}`);
  return val;
};

async function main() {
  const spotifyClientId = required('SPOTIFY_CLIENT_ID');
  const spotifyClientSecret = required('SPOTIFY_CLIENT_SECRET');
  const port = parseInt(process.env.PORT ?? '3000', 10);
  const spotifyRefreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

  createServer(spotifyClientId, spotifyClientSecret, port, process.env.BASE_URL);

  if (!spotifyRefreshToken) {
    console.log('SPOTIFY_REFRESH_TOKEN not set.');
    console.log(`Visit ${process.env.BASE_URL ?? `http://127.0.0.1:${port}`}/auth to authorize and get your refresh token.`);
    return;
  }

  const discordToken = required('DISCORD_TOKEN');
  const discordClientId = required('DISCORD_CLIENT_ID');

  const spotify = new SpotifyClient(spotifyClientId, spotifyClientSecret, spotifyRefreshToken);
  const client = createClient();

  const commands: Record<string, CommandHandler> = {
    add: addCommand(spotify),
    'add-artist': addArtistCommand(spotify),
    'add-playlist': addPlaylistCommand(spotify),
    queue: queueCommand(spotify),
    now: nowCommand(spotify),
    skip: skipCommand(spotify),
    'start-jam': startJamCommand(spotify),
    'stop-jam': stopJamCommand(spotify),
  };

  client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {
      const handler = commands[interaction.commandName];
      if (handler) {
        const args = interaction.options.data.map(o => `${o.name}=${o.value}`).join(' ');
        console.log(`[Command] /${interaction.commandName} ${args} (by ${interaction.user.tag})`);
        try {
          await handler(interaction as ChatInputCommandInteraction);
        } catch (err) {
          console.error(`[Command] /${interaction.commandName} FAILED:`, err);
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
  });

  client.once(Events.ClientReady, async c => {
    console.log(`Logged in as ${c.user.tag}`);
  });

  await registerCommands(discordClientId, discordToken);
  await client.login(discordToken);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
