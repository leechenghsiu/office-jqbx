import type { ChatInputCommandInteraction } from 'discord.js';
import { Rotation } from '../rotation.js';
import { SpotifyClient } from '../spotify.js';

export interface StopJamCallbacks {
  onStopped: () => void;
}

export function stopJamCommand(rotation: Rotation, spotify: SpotifyClient, callbacks: StopJamCallbacks) {
  return async (interaction: ChatInputCommandInteraction) => {
    await spotify.pause();
    callbacks.onStopped();

    const djCount = rotation.getDJs().length;
    while (rotation.getDJs().length > 0) {
      rotation.leave(rotation.getDJs()[0].userId);
    }

    await interaction.reply(`⏹️ Jam stopped. ${djCount} DJ${djCount !== 1 ? 's' : ''} cleared. See you next time!`);
  };
}
