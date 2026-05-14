const SPOTIFY_API = 'https://api.spotify.com/v1';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

export interface Track {
  uri: string;
  title: string;
  artist: string;
  albumArt: string;
}

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

    const url = `${SPOTIFY_API}${endpoint}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.clone().text().catch(() => '');
      console.error(`[Spotify] ${method} ${endpoint} → ${res.status} ${text}`);
    } else {
      console.log(`[Spotify] ${method} ${endpoint} → ${res.status}`);
    }

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
    }));
  }

  async searchArtistTracks(artistName: string, limit = 20): Promise<Track[]> {
    return this.search(`artist:${artistName}`, limit);
  }

  async searchArtists(query: string, limit = 5): Promise<Array<{ id: string; name: string; image: string }>> {
    const res = await this.request('GET', `/search?q=${encodeURIComponent(query)}&type=artist&limit=${limit}`);
    if (!res.ok) return [];

    const data = await res.json() as {
      artists: {
        items: Array<{
          id: string;
          name: string;
          images: Array<{ url: string }>;
        }>;
      };
    };

    return data.artists.items
      .filter(a => a?.id && a?.name)
      .map(a => ({
        id: a.id,
        name: a.name,
        image: a.images?.[0]?.url ?? '',
      }));
  }


  async addToQueue(uri: string): Promise<boolean> {
    const res = await this.request('POST', `/me/player/queue?uri=${encodeURIComponent(uri)}`);
    return res.ok;
  }

  async getQueue(): Promise<{ currentlyPlaying: Track | null; queue: Track[] }> {
    const res = await this.request('GET', '/me/player/queue');
    if (!res.ok) return { currentlyPlaying: null, queue: [] };

    const data = await res.json() as {
      currently_playing: { uri: string; name: string; artists: Array<{ name: string }>; album: { images: Array<{ url: string }> } } | null;
      queue: Array<{ uri: string; name: string; artists: Array<{ name: string }>; album: { images: Array<{ url: string }> } }>;
    };

    const mapTrack = (t: { uri: string; name: string; artists: Array<{ name: string }>; album: { images: Array<{ url: string }> } }): Track => ({
      uri: t.uri,
      title: t.name,
      artist: t.artists.map(a => a.name).join(', '),
      albumArt: t.album.images[0]?.url ?? '',
    });

    return {
      currentlyPlaying: data.currently_playing ? mapTrack(data.currently_playing) : null,
      queue: data.queue.map(mapTrack),
    };
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

  async transferPlayback(deviceId: string, play = true): Promise<boolean> {
    const res = await this.request('PUT', '/me/player', { device_ids: [deviceId], play });
    return res.ok;
  }

  async pause(): Promise<boolean> {
    const res = await this.request('PUT', '/me/player/pause');
    return res.ok;
  }

  async getCurrentlyPlaying(): Promise<{
    track: Track;
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
      track: {
        uri: data.item.uri,
        title: data.item.name,
        artist: data.item.artists.map(a => a.name).join(', '),
        albumArt: data.item.album.images[0]?.url ?? '',
      },
      progressMs: data.progress_ms,
      durationMs: data.item.duration_ms,
      isPlaying: data.is_playing,
    };
  }
}
