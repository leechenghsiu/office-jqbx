import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { SpotifyClient } from '../spotify.js';

export function addCommand(spotify: SpotifyClient) {
  return async (interaction: ChatInputCommandInteraction) => {
    const query = interaction.options.getString('query', true);
    await interaction.deferReply();

    const results = await spotify.search(query);
    if (results.length === 0) {
      const embed = new EmbedBuilder()
        .setDescription('No results found. Try a different search.')
        .setColor(0xED4245);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'Choose a song to add' })
      .setDescription(
        results.map((t, i) => `\`${i + 1}\` **${t.title}**\n╰ ${t.artist}`).join('\n\n'),
      )
      .setThumbnail(results[0].albumArt || null)
      .setColor(0x1DB954)
      .setFooter({ text: `Search: "${query}"` });

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('add_select')
        .setPlaceholder('Select a song...')
        .addOptions(
          results.map((t, i) => ({
            label: t.title.slice(0, 100),
            description: t.artist.slice(0, 100),
            value: String(i),
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
      const track = results[index];

      const ok = await spotify.addToQueue(track.uri);
      const resultEmbed = new EmbedBuilder().setColor(ok ? 0x1DB954 : 0xED4245);

      if (ok) {
        resultEmbed
          .setAuthor({ name: 'Added to queue' })
          .setDescription(`**${track.title}**\n${track.artist}`)
          .setThumbnail(track.albumArt || null);
      } else {
        resultEmbed.setDescription('Failed to add to queue. Use `/start-jam` first.');
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
