import type { ChatInputCommandInteraction } from 'discord.js';
import { Rotation } from '../rotation.js';

export function removeCommand(rotation: Rotation) {
  return async (interaction: ChatInputCommandInteraction) => {
    const index = interaction.options.getInteger('index', true) - 1;
    const removed = rotation.removeTrack(interaction.user.id, index);

    if (removed) {
      await interaction.reply(`🗑️ Removed **${removed.title}** — ${removed.artist} from your queue`);
    } else {
      await interaction.reply({ content: 'Invalid index. Check your queue with `/queue`.', ephemeral: true });
    }
  };
}
