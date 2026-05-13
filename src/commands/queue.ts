import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { Rotation } from '../rotation.js';

export function queueCommand(rotation: Rotation) {
  return async (interaction: ChatInputCommandInteraction) => {
    const queue = rotation.getQueue(interaction.user.id);

    if (queue.length === 0) {
      await interaction.reply({ content: 'Your queue is empty. Use `/add` to add songs!', ephemeral: true });
      return;
    }

    const lines = queue.map((t, i) => `**${i + 1}.** ${t.title} — ${t.artist}`);

    const embed = new EmbedBuilder()
      .setTitle('🎵 Your DJ Queue')
      .setDescription(lines.join('\n'))
      .setFooter({ text: `${queue.length} song${queue.length !== 1 ? 's' : ''}` })
      .setColor(0x1DB954);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  };
}
