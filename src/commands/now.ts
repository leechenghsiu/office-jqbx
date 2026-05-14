import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { SpotifyClient } from '../spotify.js';

export function nowCommand(spotify: SpotifyClient) {
  return async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    const playback = await spotify.getCurrentlyPlaying();
    if (!playback) {
      const embed = new EmbedBuilder()
        .setDescription('Nothing is playing right now. Use `/start-jam` to begin!')
        .setColor(0x95A5A6);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const { track, progressMs, durationMs, isPlaying } = playback;

    const embed = new EmbedBuilder()
      .setAuthor({ name: isPlaying ? 'Now Playing' : 'Paused' })
      .setTitle(track.title)
      .setDescription(track.artist)
      .addFields({ name: '​', value: formatProgress(progressMs, durationMs) })
      .setColor(isPlaying ? 0x1DB954 : 0xFEE75C);

    if (track.albumArt) embed.setImage(track.albumArt);

    await interaction.editReply({ embeds: [embed] });
  };
}

function formatProgress(progressMs: number, durationMs: number): string {
  const barLength = 16;
  const filled = Math.round((progressMs / durationMs) * barLength);
  const bar = '▬'.repeat(filled) + '🔘' + '▬'.repeat(barLength - filled);
  return `${formatTime(progressMs)} ${bar} ${formatTime(durationMs)}`;
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}
