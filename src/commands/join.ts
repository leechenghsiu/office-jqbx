import type { ChatInputCommandInteraction } from 'discord.js';
import { Rotation } from '../rotation.js';

export function joinCommand(rotation: Rotation) {
  return async (interaction: ChatInputCommandInteraction) => {
    const added = rotation.join(interaction.user.id);
    if (added) {
      await interaction.reply(`🎧 **${interaction.user.displayName}** joined the DJ rotation! (${rotation.getDJs().length} DJs)`);
    } else {
      await interaction.reply({ content: 'You\'re already in the rotation!', ephemeral: true });
    }
  };
}
