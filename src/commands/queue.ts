import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { SpotifyClient } from '../spotify.js';

export function queueCommand(spotify: SpotifyClient) {
  return async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    const { currentlyPlaying, queue } = await spotify.getQueue();

    if (!currentlyPlaying && queue.length === 0) {
      await interaction.editReply('Nothing in the queue. Use `/add` to add songs!');
      return;
    }

    const lines: string[] = [];
    if (currentlyPlaying) {
      lines.push(`▶ **${currentlyPlaying.title}** — ${currentlyPlaying.artist}`);
    }

    const upcoming = queue.slice(0, 10);
    if (upcoming.length > 0) {
      lines.push('', '**Up next:**');
      upcoming.forEach((t, i) => {
        lines.push(`${i + 1}. ${t.title} — ${t.artist}`);
      });
      if (queue.length > 10) {
        lines.push(`...and ${queue.length - 10} more`);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('🎵 Queue')
      .setDescription(lines.join('\n'))
      .setColor(0x1DB954);

    if (currentlyPlaying?.albumArt) embed.setThumbnail(currentlyPlaying.albumArt);

    await interaction.editReply({ embeds: [embed] });
  };
}
