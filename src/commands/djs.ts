import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { Rotation } from '../rotation.js';

export function djsCommand(rotation: Rotation) {
  return async (interaction: ChatInputCommandInteraction) => {
    const djs = rotation.getDJs();
    if (djs.length === 0) {
      await interaction.reply('No DJs in the rotation. Use `/join` to start!');
      return;
    }

    const currentDJ = rotation.getCurrentDJ();
    const lines = djs.map(dj => {
      const marker = dj.userId === currentDJ?.userId ? '▶' : '　';
      const songCount = dj.queue.length;
      return `${marker} <@${dj.userId}> — ${songCount} song${songCount !== 1 ? 's' : ''} queued`;
    });

    const embed = new EmbedBuilder()
      .setTitle('🎶 DJ Rotation')
      .setDescription(lines.join('\n'))
      .setColor(0x1DB954);

    await interaction.reply({ embeds: [embed] });
  };
}
