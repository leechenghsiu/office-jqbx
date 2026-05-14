import type { ChatInputCommandInteraction } from 'discord.js';
import { SpotifyClient } from '../spotify.js';

export function stopJamCommand(spotify: SpotifyClient) {
  return async (interaction: ChatInputCommandInteraction) => {
    await spotify.pause();
    await interaction.reply('⏹️ Jam stopped. See you next time!');
  };
}
