// src/spotify.ts
import { Track } from './rotation.js';

const SPOTIFY_API = 'https://api.spotify.com/v1';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

export class SpotifyClient {
  private accessToken = '';
  private tokenExpiry = 0;

  constructor(
    private clientId: string,
    private clientSecret: string,
    private refreshToken: string,
  ) {}

  private async refreshAccessToken(): Promise<void> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
    });

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body,
    });

    if (!res.ok) {
      throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json() as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000 - 60_000;
  }

  private async request(method: string, endpoint: string, body?: unknown): Promise<Response> {
    if (Date.now() >= this.tokenExpiry) {
      await this.refreshAccessToken();
    }

    const res = await fetch(`${SPOTIFY_API}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    return res;
  }

  async search(query: string, limit = 5): Promise<Track[]> {
    const res = await this.request('GET', `/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`);
    if (!res.ok) return [];

    const data = await res.json() as {
      tracks: {
        items: Array<{
          uri: string;
          name: string;
          artists: Array<{ name: string }>;
          album: { images: Array<{ url: string }> };
        }>;
      };
    };

    return data.tracks.items.map(item => ({
      uri: item.uri,
      title: item.name,
      artist: item.artists.map(a => a.name).join(', '),
      albumArt: item.album.images[0]?.url ?? '',
      addedBy: '',
    }));
  }

  async play(uri: string): Promise<boolean> {
    const res = await this.request('PUT', '/me/player/play', { uris: [uri] });
    return res.ok;
  }

  async skip(): Promise<boolean> {
    const res = await this.request('POST', '/me/player/next');
    return res.ok;
  }

  async getDevices(): Promise<Array<{ id: string; name: string; type: string; isActive: boolean }>> {
    const res = await this.request('GET', '/me/player/devices');
    if (!res.ok) return [];
    const data = await res.json() as {
      devices: Array<{ id: string; name: string; type: string; is_active: boolean }>;
    };
    return data.devices.map(d => ({ id: d.id, name: d.name, type: d.type, isActive: d.is_active }));
  }

  async transferPlayback(deviceId: string): Promise<boolean> {
    const res = await this.request('PUT', '/me/player', { device_ids: [deviceId], play: false });
    return res.ok;
  }

  async pause(): Promise<boolean> {
    const res = await this.request('PUT', '/me/player/pause');
    return res.ok;
  }

  async getCurrentlyPlaying(): Promise<{
    uri: string;
    title: string;
    artist: string;
    albumArt: string;
    progressMs: number;
    durationMs: number;
    isPlaying: boolean;
  } | null> {
    const res = await this.request('GET', '/me/player/currently-playing');
    if (!res.ok || res.status === 204) return null;

    const data = await res.json() as {
      is_playing: boolean;
      progress_ms: number;
      item: {
        uri: string;
        name: string;
        duration_ms: number;
        artists: Array<{ name: string }>;
        album: { images: Array<{ url: string }> };
      } | null;
    };

    if (!data.item) return null;

    return {
      uri: data.item.uri,
      title: data.item.name,
      artist: data.item.artists.map(a => a.name).join(', '),
      albumArt: data.item.album.images[0]?.url ?? '',
      progressMs: data.progress_ms,
      durationMs: data.item.duration_ms,
      isPlaying: data.is_playing,
    };
  }
}
