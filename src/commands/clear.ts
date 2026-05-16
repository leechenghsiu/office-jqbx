import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { SpotifyClient } from '../spotify.js';

export function clearCommand(spotify: SpotifyClient) {
  return async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    const playback = await spotify.getCurrentlyPlaying();
    if (!playback) {
      const embed = new EmbedBuilder()
        .setDescription('Nothing is playing right now.')
        .setColor(0x95A5A6);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const ok = await spotify.play(playback.track.uri, playback.progressMs);
    if (!ok) {
      const embed = new EmbedBuilder()
        .setDescription('Failed to clear the queue.')
        .setColor(0xE74C3C);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setDescription('Queue cleared. Upcoming songs will auto-play from what\'s queued next.')
      .setColor(0x1DB954);
    await interaction.editReply({ embeds: [embed] });
  };
}
