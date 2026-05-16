import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { SpotifyClient } from '../spotify.js';

export function addArtistCommand(spotify: SpotifyClient) {
  return async (interaction: ChatInputCommandInteraction) => {
    const query = interaction.options.getString('query', true);
    await interaction.deferReply();

    const artists = await spotify.searchArtists(query);
    if (artists.length === 0) {
      const embed = new EmbedBuilder()
        .setDescription('No artists found. Try a different search.')
        .setColor(0xED4245);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'Choose an artist' })
      .setDescription(
        artists.map((a, i) => `\`${i + 1}\` **${a.name}**`).join('\n'),
      )
      .setThumbnail(artists[0].image || null)
      .setColor(0x1DB954)
      .setFooter({ text: `Search: "${query}"` });

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('artist_select')
        .setPlaceholder('Select an artist...')
        .addOptions(
          artists.map((a, i) => ({
            label: a.name.slice(0, 100),
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
      const artist = artists[index];

      const loadingEmbed = new EmbedBuilder()
        .setAuthor({ name: 'Adding songs...' })
        .setDescription(`**${artist.name}**\nSearching for tracks...`)
        .setThumbnail(artist.image || null)
        .setColor(0xFEE75C);
      await selectInteraction.update({ embeds: [loadingEmbed], components: [] });

      const tracks = await spotify.getArtistTopTracks(artist.id);
      let added = 0;
      for (const track of tracks) {
        const ok = await spotify.addToQueue(track.uri);
        if (ok) added++;
      }

      const resultEmbed = new EmbedBuilder()
        .setAuthor({ name: 'Artist added to queue' })
        .setDescription(`**${artist.name}**\n${added} songs added`)
        .setThumbnail(artist.image || null)
        .setColor(0x1DB954);
      await interaction.editReply({ embeds: [resultEmbed] });
    } catch {
      const embed = new EmbedBuilder()
        .setDescription('Selection timed out.')
        .setColor(0x95A5A6);
      await interaction.editReply({ embeds: [embed], components: [] });
    }
  };
}
