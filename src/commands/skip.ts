import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { SpotifyClient } from '../spotify.js';

export function skipCommand(spotify: SpotifyClient) {
  return async (interaction: ChatInputCommandInteraction) => {
    const current = await spotify.getCurrentlyPlaying();
    const ok = await spotify.skip();

    if (ok && current) {
      const embed = new EmbedBuilder()
        .setDescription(`⏭️ **${interaction.user.displayName}** skipped **${current.track.title}**`)
        .setColor(0x1DB954);
      await interaction.reply({ embeds: [embed] });
    } else if (ok) {
      const embed = new EmbedBuilder()
        .setDescription(`⏭️ **${interaction.user.displayName}** skipped the current song`)
        .setColor(0x1DB954);
      await interaction.reply({ embeds: [embed] });
    } else {
      const embed = new EmbedBuilder()
        .setDescription('Nothing is playing.')
        .setColor(0xED4245);
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  };
}
