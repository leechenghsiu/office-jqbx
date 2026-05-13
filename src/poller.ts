import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Client,
  type TextChannel,
} from 'discord.js';
import { Rotation } from './rotation.js';
import { SpotifyClient } from './spotify.js';

export class Poller {
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastUri: string | null = null;
  private channelId: string | null = null;

  constructor(
    private rotation: Rotation,
    private spotify: SpotifyClient,
    private client: Client,
  ) {}

  setChannel(channelId: string) {
    this.channelId = channelId;
  }

  start() {
    this.interval = setInterval(() => this.poll(), 5000);
    console.log('Playback poller started');
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async playNext(): Promise<boolean> {
    const next = this.rotation.advance();
    if (!next) {
      this.lastUri = null;
      await this.postMessage('🔇 No more songs in the queue. Use `/add` to keep the party going!');
      return false;
    }

    const ok = await this.spotify.play(next.uri);
    if (!ok) {
      await this.postMessage('⚠️ Spotify is not active on any device. Start playback on your device first.');
      return false;
    }

    this.lastUri = next.uri;
    await this.postNowPlaying(next);
    return true;
  }

  private async poll() {
    try {
      const current = await this.spotify.getCurrentlyPlaying();

      if (!current || !current.isPlaying) return;

      if (this.lastUri && current.uri !== this.lastUri) {
        await this.playNext();
        return;
      }

      if (current.durationMs - current.progressMs < 5000 && this.lastUri) {
        await new Promise(r => setTimeout(r, current.durationMs - current.progressMs + 500));
        await this.playNext();
      }
    } catch (err) {
      console.error('Poller error:', err);
    }
  }

  private async postNowPlaying(track: { title: string; artist: string; albumArt: string; addedBy: string }) {
    const embed = new EmbedBuilder()
      .setTitle(`🎵 Now Playing: ${track.title}`)
      .setDescription(`by **${track.artist}**`)
      .addFields({ name: 'DJ', value: `<@${track.addedBy}>`, inline: true })
      .setColor(0x1DB954);

    if (track.albumArt) embed.setThumbnail(track.albumArt);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('vote_fire').setEmoji('🔥').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('vote_skip').setEmoji('👎').setStyle(ButtonStyle.Secondary),
    );

    await this.postMessage({ embeds: [embed], components: [row] });
  }

  private async postMessage(content: string | { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] }) {
    if (!this.channelId) return;
    try {
      const channel = await this.client.channels.fetch(this.channelId) as TextChannel;
      if (channel) {
        await channel.send(content);
      }
    } catch (err) {
      console.error('Failed to post message:', err);
    }
  }
}
