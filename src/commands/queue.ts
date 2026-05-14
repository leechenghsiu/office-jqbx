import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { SpotifyClient } from '../spotify.js';

export function queueCommand(spotify: SpotifyClient) {
  return async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    const { currentlyPlaying, queue } = await spotify.getQueue();

    if (!currentlyPlaying && queue.length === 0) {
      const embed = new EmbedBuilder()
        .setDescription('Queue is empty. Use `/add` to add songs!')
        .setColor(0x95A5A6);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const lines: string[] = [];

    if (currentlyPlaying) {
      lines.push(`**Now Playing**\n🎵 **${currentlyPlaying.title}** — ${currentlyPlaying.artist}\n`);
    }

    const upcoming = queue.slice(0, 10);
    if (upcoming.length > 0) {
      lines.push('**Up Next**');
      upcoming.forEach((t, i) => {
        lines.push(`\`${i + 1}\` ${t.title} — ${t.artist}`);
      });
      if (queue.length > 10) {
        lines.push(`\n*...and ${queue.length - 10} more*`);
      }
    }

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'Queue' })
      .setDescription(lines.join('\n'))
      .setColor(0x1DB954)
      .setFooter({ text: `${queue.length} song${queue.length !== 1 ? 's' : ''} in queue` });

    if (currentlyPlaying?.albumArt) embed.setThumbnail(currentlyPlaying.albumArt);

    await interaction.editReply({ embeds: [embed] });
  };
}
