import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { SpotifyClient } from '../spotify.js';

export function stopJamCommand(spotify: SpotifyClient) {
  return async (interaction: ChatInputCommandInteraction) => {
    await spotify.pause();
    const embed = new EmbedBuilder()
      .setAuthor({ name: 'Jam Stopped' })
      .setDescription('Playback paused. See you next time!')
      .setColor(0x95A5A6);
    await interaction.reply({ embeds: [embed] });
  };
}
