import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { Rotation } from '../rotation.js';
import { SpotifyClient } from '../spotify.js';

export function nowCommand(rotation: Rotation, spotify: SpotifyClient) {
  return async (interaction: ChatInputCommandInteraction) => {
    const current = rotation.getCurrentTrack();
    if (!current) {
      await interaction.reply('Nothing is playing right now. Add songs with `/add` and `/join` the rotation!');
      return;
    }

    const playback = await spotify.getCurrentlyPlaying();
    const votes = rotation.getVotes();
    const progressBar = playback ? formatProgress(playback.progressMs, playback.durationMs) : '';

    const embed = new EmbedBuilder()
      .setTitle(current.title)
      .setDescription(`by **${current.artist}**`)
      .addFields(
        { name: 'DJ', value: `<@${current.addedBy}>`, inline: true },
        { name: 'Votes', value: `🔥 ${votes.fire}　👎 ${votes.skip}`, inline: true },
      )
      .setColor(0x1DB954);

    if (current.albumArt) embed.setThumbnail(current.albumArt);
    if (progressBar) embed.addFields({ name: 'Progress', value: progressBar });

    await interaction.reply({ embeds: [embed] });
  };
}

function formatProgress(progressMs: number, durationMs: number): string {
  const progress = Math.floor(progressMs / 1000);
  const duration = Math.floor(durationMs / 1000);
  const barLength = 20;
  const filled = Math.round((progressMs / durationMs) * barLength);
  const bar = '▓'.repeat(filled) + '░'.repeat(barLength - filled);
  return `${formatTime(progress)} ${bar} ${formatTime(duration)}`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
