import type { ChatInputCommandInteraction } from 'discord.js';
import { Rotation } from '../rotation.js';

export interface SkipCallbacks {
  onSkip: () => Promise<void>;
}

export function skipCommand(rotation: Rotation, callbacks: SkipCallbacks) {
  return async (interaction: ChatInputCommandInteraction) => {
    const current = rotation.getCurrentTrack();
    if (!current) {
      await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
      return;
    }

    const shouldSkip = rotation.voteSkip(interaction.user.id);
    const votes = rotation.getVotes();
    const needed = Math.floor(rotation.getDJs().length / 2) + 1;

    if (shouldSkip) {
      await interaction.reply(`⏭️ Skipped **${current.title}** (${votes.skip}/${needed} votes)`);
      await callbacks.onSkip();
    } else {
      await interaction.reply(`👎 ${interaction.user.displayName} voted to skip (${votes.skip}/${needed} needed)`);
    }
  };
}
