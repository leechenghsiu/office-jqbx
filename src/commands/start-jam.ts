import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { SpotifyClient } from '../spotify.js';

const deviceEmoji: Record<string, string> = {
  Computer: '💻',
  Smartphone: '📱',
  Speaker: '🔊',
  TV: '📺',
  CastAudio: '🔊',
  CastVideo: '📺',
};

export function startJamCommand(spotify: SpotifyClient) {
  return async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    const devices = await spotify.getDevices();
    if (devices.length === 0) {
      const embed = new EmbedBuilder()
        .setDescription('No Spotify devices found.\nMake sure Spotify is open on at least one device.')
        .setColor(0xED4245);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'Start Jam' })
      .setDescription('Select a device to start playing on:')
      .setColor(0x1DB954);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('device_select')
        .setPlaceholder('Select a device...')
        .addOptions(
          devices.slice(0, 5).map((d, i) => ({
            label: d.name,
            description: `${d.type}${d.isActive ? ' · Active' : ''}`,
            value: String(i),
            emoji: deviceEmoji[d.type] ?? '🎵',
          })),
        ),
    );

    const reply = await interaction.editReply({ embeds: [embed], components: [row] });

    try {
      const selectInteraction = await reply.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        filter: i => i.user.id === interaction.user.id,
        time: 30_000,
      });

      const index = parseInt(selectInteraction.values[0]);
      const device = devices[index];

      const ok = await spotify.transferPlayback(device.id);
      const resultEmbed = new EmbedBuilder();

      if (ok) {
        resultEmbed
          .setAuthor({ name: 'Jam Started' })
          .setDescription(`Connected to **${device.name}**\nUse \`/add\` or \`/add-playlist\` to queue songs!`)
          .setColor(0x1DB954);
      } else {
        resultEmbed
          .setDescription('Failed to connect to device.')
          .setColor(0xED4245);
      }

      await selectInteraction.update({ embeds: [resultEmbed], components: [] });
    } catch {
      const embed = new EmbedBuilder()
        .setDescription('Selection timed out.')
        .setColor(0x95A5A6);
      await interaction.editReply({ embeds: [embed], components: [] });
    }
  };
}
