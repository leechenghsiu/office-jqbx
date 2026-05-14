import type { ChatInputCommandInteraction } from 'discord.js';
import { SpotifyClient } from '../spotify.js';

export function skipCommand(spotify: SpotifyClient) {
  return async (interaction: ChatInputCommandInteraction) => {
    const ok = await spotify.skip();
    if (ok) {
      await interaction.reply(`⏭️ ${interaction.user.displayName} skipped the current song`);
    } else {
      await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
    }
  };
}
