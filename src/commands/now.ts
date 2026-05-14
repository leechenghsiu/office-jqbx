import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { SpotifyClient } from '../spotify.js';

export function nowCommand(spotify: SpotifyClient) {
  return async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    const playback = await spotify.getCurrentlyPlaying();
    if (!playback) {
      await interaction.editReply('Nothing is playing right now. Use `/start-jam` to begin!');
      return;
    }

    const { track, progressMs, durationMs } = playback;
    const progressBar = formatProgress(progressMs, durationMs);

    const embed = new EmbedBuilder()
      .setTitle(track.title)
      .setDescription(`by **${track.artist}**`)
      .addFields({ name: 'Progress', value: progressBar })
      .setColor(0x1DB954);

    if (track.albumArt) embed.setThumbnail(track.albumArt);

    await interaction.editReply({ embeds: [embed] });
  };
}

function formatProgress(progressMs: number, durationMs: number): string {
  const barLength = 20;
  const filled = Math.round((progressMs / durationMs) * barLength);
  const bar = '▓'.repeat(filled) + '░'.repeat(barLength - filled);
  return `${formatTime(progressMs)} ${bar} ${formatTime(durationMs)}`;
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}
