import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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
      await interaction.editReply('No playlists found. Try a different search.');
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`🔍 Playlists: "${query}"`)
      .setDescription(
        playlists.map((p, i) => `**${i + 1}.** ${p.name} — by ${p.owner} (${p.trackCount} songs)`).join('\n'),
      )
      .setColor(0x1DB954);

    if (playlists[0].image) embed.setThumbnail(playlists[0].image);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      playlists.map((_, i) =>
        new ButtonBuilder()
          .setCustomId(`playlist_${i}`)
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
      const playlist = playlists[index];

      await btnInteraction.update({
        content: `⏳ Adding **${playlist.name}** to queue...`,
        embeds: [],
        components: [],
      });

      const tracks = await spotify.getPlaylistTracks(playlist.id);
      let added = 0;
      for (const track of tracks) {
        const ok = await spotify.addToQueue(track.uri);
        if (ok) added++;
      }

      await interaction.editReply(`✅ Added **${added}** songs from **${playlist.name}** to the queue`);
    } catch {
      await interaction.editReply({ content: 'Selection timed out.', embeds: [], components: [] });
    }
  };
}
