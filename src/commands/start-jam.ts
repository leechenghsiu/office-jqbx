import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { SpotifyClient } from '../spotify.js';

export function startJamCommand(spotify: SpotifyClient) {
  return async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    const devices = await spotify.getDevices();
    if (devices.length === 0) {
      await interaction.editReply('⚠️ No Spotify devices found. Make sure Spotify is open on at least one device.');
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🔊 Select a device to start the Jam')
      .setDescription(
        devices.map((d, i) => `**${i + 1}.** ${d.name} (${d.type})${d.isActive ? ' ✓ active' : ''}`).join('\n'),
      )
      .setColor(0x1DB954);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      devices.slice(0, 5).map((_, i) =>
        new ButtonBuilder()
          .setCustomId(`device_${i}`)
          .setLabel(`${i + 1}`)
          .setStyle(ButtonStyle.Primary),
      ),
    );

    const reply = await interaction.editReply({ embeds: [embed], components: [row] });

    try {
      const btnInteraction = await reply.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: i => i.user.id === interaction.user.id,
        time: 30_000,
      });

      const index = parseInt(btnInteraction.customId.split('_')[1]);
      const device = devices[index];

      const ok = await spotify.transferPlayback(device.id);
      if (!ok) {
        await btnInteraction.update({ content: '⚠️ Failed to connect to device.', embeds: [], components: [] });
        return;
      }

      await btnInteraction.update({
        content: `🎶 Jam started on **${device.name}**! Use \`/add\` to queue songs.`,
        embeds: [],
        components: [],
      });
    } catch {
      await interaction.editReply({ content: 'Selection timed out.', embeds: [], components: [] });
    }
  };
}
