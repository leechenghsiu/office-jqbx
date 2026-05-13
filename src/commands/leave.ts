import type { ChatInputCommandInteraction } from 'discord.js';
import { Rotation } from '../rotation.js';

export function leaveCommand(rotation: Rotation) {
  return async (interaction: ChatInputCommandInteraction) => {
    const removed = rotation.leave(interaction.user.id);
    if (removed) {
      await interaction.reply(`👋 **${interaction.user.displayName}** left the DJ rotation. (${rotation.getDJs().length} DJs)`);
    } else {
      await interaction.reply({ content: 'You\'re not in the rotation.', ephemeral: true });
    }
  };
}
