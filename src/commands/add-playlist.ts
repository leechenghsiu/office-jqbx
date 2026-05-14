import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { SpotifyClient } from '../spotify.js';

export function addPlaylistCommand(spotify: SpotifyClient) {
  return async (interaction: ChatInputCommandInteraction) => {
    const query = interaction.options.getString('query', true);
    await interaction.deferReply();

    const playlists = await spotify.searchPlaylists(query);
    if (playlists.length === 0) {
      const embed = new EmbedBuilder()
        .setDescription('No playlists found. Try a different search.')
        .setColor(0xED4245);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'Choose a playlist to add' })
      .setDescription(
        playlists.map((p, i) => `\`${i + 1}\` **${p.name}**\n╰ by ${p.owner} · ${p.trackCount} songs`).join('\n\n'),
      )
      .setThumbnail(playlists[0].image || null)
      .setColor(0x1DB954)
      .setFooter({ text: `Search: "${query}"` });

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('playlist_select')
        .setPlaceholder('Select a playlist...')
        .addOptions(
          playlists.map((p, i) => ({
            label: p.name.slice(0, 100),
            description: `by ${p.owner} · ${p.trackCount} songs`.slice(0, 100),
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
      const playlist = playlists[index];

      const loadingEmbed = new EmbedBuilder()
        .setAuthor({ name: 'Adding playlist...' })
        .setDescription(`**${playlist.name}**\nLoading tracks...`)
        .setThumbnail(playlist.image || null)
        .setColor(0xFEE75C);

      await selectInteraction.update({ embeds: [loadingEmbed], components: [] });

      const tracks = await spotify.getPlaylistTracks(playlist.id);
      let added = 0;
      for (const track of tracks) {
        const ok = await spotify.addToQueue(track.uri);
        if (ok) added++;
      }

      const resultEmbed = new EmbedBuilder()
        .setAuthor({ name: 'Playlist added to queue' })
        .setDescription(`**${playlist.name}**\n${added} songs added`)
        .setThumbnail(playlist.image || null)
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
