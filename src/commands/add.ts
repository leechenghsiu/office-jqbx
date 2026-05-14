import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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
      await interaction.editReply('No results found. Try a different search.');
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`🔍 Search: "${query}"`)
      .setDescription(
        results.map((t, i) => `**${i + 1}.** ${t.title} — ${t.artist}`).join('\n'),
      )
      .setColor(0x1DB954);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      results.map((_, i) =>
        new ButtonBuilder()
          .setCustomId(`add_${i}`)
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
      const track = results[index];

      const ok = await spotify.addToQueue(track.uri);
      if (ok) {
        await btnInteraction.update({
          content: `✅ Added **${track.title}** — ${track.artist} to the queue`,
          embeds: [],
          components: [],
        });
      } else {
        await btnInteraction.update({
          content: '⚠️ Failed to add to queue. Is Spotify active on a device? Use `/start-jam` first.',
          embeds: [],
          components: [],
        });
      }
    } catch {
      await interaction.editReply({ content: 'Selection timed out.', embeds: [], components: [] });
    }
  };
}
