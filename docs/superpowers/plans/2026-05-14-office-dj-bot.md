# Office DJ Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Discord bot that replicates JQBX-style DJ rotation, controlling Spotify playback on an office smart speaker.

**Architecture:** Single Node.js process running a Discord.js client, Spotify Web API client, in-memory DJ rotation engine, and a minimal Express server for OAuth. No database — all state lives in memory.

**Tech Stack:** TypeScript, discord.js, Express, Vitest, Spotify Web API (direct fetch)

---

## File Map

| File | Responsibility |
|------|---------------|
| `package.json` | Dependencies and scripts |
| `tsconfig.json` | TypeScript config |
| `src/rotation.ts` | DJ rotation state machine — join/leave/queue/advance/vote (pure logic, no I/O) |
| `src/rotation.test.ts` | Tests for rotation engine |
| `src/spotify.ts` | Spotify Web API client — token refresh, search, playback control |
| `src/discord.ts` | Discord client setup, slash command definitions, event wiring |
| `src/commands/join.ts` | `/join` handler |
| `src/commands/leave.ts` | `/leave` handler |
| `src/commands/add.ts` | `/add` handler with search result buttons |
| `src/commands/remove.ts` | `/remove` handler |
| `src/commands/queue.ts` | `/queue` handler |
| `src/commands/now.ts` | `/now` handler |
| `src/commands/skip.ts` | `/skip` handler |
| `src/commands/djs.ts` | `/djs` handler |
| `src/poller.ts` | Polls Spotify for track changes, advances rotation |
| `src/server.ts` | Express: `/auth`, `/callback`, `/health` |
| `src/index.ts` | Entry point — boots everything |
| `Dockerfile` | Container image |
| `.env.example` | Template for environment variables |
| `README.md` | Setup and usage guide |

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`

- [ ] **Step 1: Initialize project and install dependencies**

```bash
cd /Users/leechenghsiu/Desktop/Zeabur/Testing/office-dj-bot
npm init -y
npm install discord.js express
npm install -D typescript @types/node @types/express vitest
```

- [ ] **Step 2: Configure package.json scripts**

Update `package.json` scripts:

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/**/*.test.ts"]
}
```

- [ ] **Step 4: Create src directory**

```bash
mkdir -p src/commands
```

- [ ] **Step 5: Commit**

```bash
git init
echo "node_modules\ndist\n.env" > .gitignore
git add package.json package-lock.json tsconfig.json .gitignore
git commit -m "chore: scaffold project with TypeScript, discord.js, express, vitest"
```

---

### Task 2: Rotation Engine — Data Types and Join/Leave (TDD)

**Files:**
- Create: `src/rotation.ts`
- Create: `src/rotation.test.ts`

- [ ] **Step 1: Write failing tests for join/leave**

```typescript
// src/rotation.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Rotation } from './rotation.js';

describe('Rotation', () => {
  let rotation: Rotation;

  beforeEach(() => {
    rotation = new Rotation();
  });

  describe('join/leave', () => {
    it('should add a DJ to the rotation', () => {
      const result = rotation.join('user-1');
      expect(result).toBe(true);
      expect(rotation.getDJs()).toHaveLength(1);
      expect(rotation.getDJs()[0].userId).toBe('user-1');
    });

    it('should not add the same DJ twice', () => {
      rotation.join('user-1');
      const result = rotation.join('user-1');
      expect(result).toBe(false);
      expect(rotation.getDJs()).toHaveLength(1);
    });

    it('should remove a DJ from the rotation', () => {
      rotation.join('user-1');
      rotation.join('user-2');
      const result = rotation.leave('user-1');
      expect(result).toBe(true);
      expect(rotation.getDJs()).toHaveLength(1);
      expect(rotation.getDJs()[0].userId).toBe('user-2');
    });

    it('should return false when removing a non-existent DJ', () => {
      const result = rotation.leave('user-1');
      expect(result).toBe(false);
    });

    it('should adjust currentIndex when removing a DJ before it', () => {
      rotation.join('user-1');
      rotation.join('user-2');
      rotation.join('user-3');
      // currentIndex starts at 0 (user-1)
      // Advance to user-2 (index 1)
      rotation.addTrack('user-1', { uri: 'a', title: 'A', artist: 'A', albumArt: '', addedBy: 'user-1' });
      rotation.addTrack('user-2', { uri: 'b', title: 'B', artist: 'B', albumArt: '', addedBy: 'user-2' });
      rotation.advance(); // now playing user-1's track, currentIndex moves to next
      rotation.leave('user-1'); // remove user before current
      expect(rotation.getDJs().map(d => d.userId)).toEqual(['user-2', 'user-3']);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/rotation.test.ts`
Expected: FAIL — module `./rotation.js` not found

- [ ] **Step 3: Implement Rotation class with join/leave**

```typescript
// src/rotation.ts
export interface Track {
  uri: string;
  title: string;
  artist: string;
  albumArt: string;
  addedBy: string;
}

export interface DJ {
  userId: string;
  queue: Track[];
}

export class Rotation {
  private djs: DJ[] = [];
  private currentIndex = 0;
  private currentTrack: Track | null = null;
  private votes = { fire: new Set<string>(), skip: new Set<string>() };

  join(userId: string): boolean {
    if (this.djs.some(dj => dj.userId === userId)) return false;
    this.djs.push({ userId, queue: [] });
    return true;
  }

  leave(userId: string): boolean {
    const index = this.djs.findIndex(dj => dj.userId === userId);
    if (index === -1) return false;
    this.djs.splice(index, 1);
    if (this.djs.length === 0) {
      this.currentIndex = 0;
    } else if (index < this.currentIndex) {
      this.currentIndex--;
    } else if (this.currentIndex >= this.djs.length) {
      this.currentIndex = 0;
    }
    return true;
  }

  getDJs(): readonly DJ[] {
    return this.djs;
  }

  getCurrentDJ(): DJ | null {
    return this.djs[this.currentIndex] ?? null;
  }

  getCurrentTrack(): Track | null {
    return this.currentTrack;
  }

  getVotes(): { fire: number; skip: number } {
    return { fire: this.votes.fire.size, skip: this.votes.skip.size };
  }

  addTrack(userId: string, track: Track): void {
    const dj = this.djs.find(d => d.userId === userId);
    if (!dj) return;
    dj.queue.push(track);
  }

  removeTrack(userId: string, index: number): Track | null {
    const dj = this.djs.find(d => d.userId === userId);
    if (!dj || index < 0 || index >= dj.queue.length) return null;
    return dj.queue.splice(index, 1)[0];
  }

  getQueue(userId: string): readonly Track[] {
    const dj = this.djs.find(d => d.userId === userId);
    return dj?.queue ?? [];
  }

  advance(): Track | null {
    this.votes = { fire: new Set(), skip: new Set() };

    const djCount = this.djs.length;
    if (djCount === 0) {
      this.currentTrack = null;
      return null;
    }

    for (let i = 0; i < djCount; i++) {
      const idx = (this.currentIndex + i) % djCount;
      const dj = this.djs[idx];
      if (dj.queue.length > 0) {
        this.currentTrack = dj.queue.shift()!;
        this.currentIndex = (idx + 1) % djCount;
        return this.currentTrack;
      }
    }

    this.currentTrack = null;
    return null;
  }

  voteFire(userId: string): boolean {
    if (this.votes.fire.has(userId)) return false;
    this.votes.fire.add(userId);
    return true;
  }

  voteSkip(userId: string): boolean {
    if (this.votes.skip.has(userId)) return false;
    this.votes.skip.add(userId);
    return this.shouldSkip();
  }

  private shouldSkip(): boolean {
    if (this.djs.length === 0) return false;
    return this.votes.skip.size > this.djs.length / 2;
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `npx vitest run src/rotation.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/rotation.ts src/rotation.test.ts
git commit -m "feat: add rotation engine with join/leave logic"
```

---

### Task 3: Rotation Engine — Queue, Advance, Voting (TDD)

**Files:**
- Modify: `src/rotation.test.ts`

- [ ] **Step 1: Write failing tests for addTrack, advance, and voting**

Append to `src/rotation.test.ts`:

```typescript
  describe('queue management', () => {
    it('should add tracks to a DJ queue', () => {
      rotation.join('user-1');
      rotation.addTrack('user-1', { uri: 'spotify:track:1', title: 'Song A', artist: 'Artist A', albumArt: 'https://img/a', addedBy: 'user-1' });
      expect(rotation.getQueue('user-1')).toHaveLength(1);
      expect(rotation.getQueue('user-1')[0].title).toBe('Song A');
    });

    it('should ignore addTrack for non-DJ users', () => {
      rotation.addTrack('user-1', { uri: 'spotify:track:1', title: 'Song A', artist: 'Artist A', albumArt: '', addedBy: 'user-1' });
      expect(rotation.getQueue('user-1')).toHaveLength(0);
    });

    it('should remove tracks by index', () => {
      rotation.join('user-1');
      rotation.addTrack('user-1', { uri: 'a', title: 'A', artist: 'A', albumArt: '', addedBy: 'user-1' });
      rotation.addTrack('user-1', { uri: 'b', title: 'B', artist: 'B', albumArt: '', addedBy: 'user-1' });
      const removed = rotation.removeTrack('user-1', 0);
      expect(removed?.title).toBe('A');
      expect(rotation.getQueue('user-1')).toHaveLength(1);
    });

    it('should return null when removing invalid index', () => {
      rotation.join('user-1');
      expect(rotation.removeTrack('user-1', 5)).toBeNull();
    });
  });

  describe('advance', () => {
    it('should play tracks round-robin across DJs', () => {
      rotation.join('user-1');
      rotation.join('user-2');
      rotation.addTrack('user-1', { uri: 'a', title: 'Song A', artist: 'A', albumArt: '', addedBy: 'user-1' });
      rotation.addTrack('user-1', { uri: 'c', title: 'Song C', artist: 'C', albumArt: '', addedBy: 'user-1' });
      rotation.addTrack('user-2', { uri: 'b', title: 'Song B', artist: 'B', albumArt: '', addedBy: 'user-2' });

      const first = rotation.advance();
      expect(first?.title).toBe('Song A');

      const second = rotation.advance();
      expect(second?.title).toBe('Song B');

      const third = rotation.advance();
      expect(third?.title).toBe('Song C');
    });

    it('should skip DJs with empty queues', () => {
      rotation.join('user-1');
      rotation.join('user-2');
      rotation.addTrack('user-2', { uri: 'b', title: 'Song B', artist: 'B', albumArt: '', addedBy: 'user-2' });

      const track = rotation.advance();
      expect(track?.title).toBe('Song B');
    });

    it('should return null when all queues are empty', () => {
      rotation.join('user-1');
      expect(rotation.advance()).toBeNull();
    });

    it('should return null when no DJs', () => {
      expect(rotation.advance()).toBeNull();
    });

    it('should reset votes on advance', () => {
      rotation.join('user-1');
      rotation.addTrack('user-1', { uri: 'a', title: 'A', artist: 'A', albumArt: '', addedBy: 'user-1' });
      rotation.addTrack('user-1', { uri: 'b', title: 'B', artist: 'B', albumArt: '', addedBy: 'user-1' });
      rotation.advance();
      rotation.voteFire('user-1');
      rotation.advance();
      expect(rotation.getVotes()).toEqual({ fire: 0, skip: 0 });
    });
  });

  describe('voting', () => {
    beforeEach(() => {
      rotation.join('user-1');
      rotation.join('user-2');
      rotation.join('user-3');
      rotation.addTrack('user-1', { uri: 'a', title: 'A', artist: 'A', albumArt: '', addedBy: 'user-1' });
      rotation.advance();
    });

    it('should record fire votes', () => {
      rotation.voteFire('user-1');
      expect(rotation.getVotes().fire).toBe(1);
    });

    it('should not allow duplicate fire votes', () => {
      rotation.voteFire('user-1');
      const result = rotation.voteFire('user-1');
      expect(result).toBe(false);
      expect(rotation.getVotes().fire).toBe(1);
    });

    it('should not skip with minority skip votes', () => {
      const shouldSkip = rotation.voteSkip('user-1');
      expect(shouldSkip).toBe(false);
    });

    it('should skip with majority skip votes', () => {
      rotation.voteSkip('user-1');
      const shouldSkip = rotation.voteSkip('user-2');
      expect(shouldSkip).toBe(true);
    });
  });
```

- [ ] **Step 2: Run tests to verify they pass** (implementation already in Task 2)

Run: `npx vitest run src/rotation.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/rotation.test.ts
git commit -m "test: add comprehensive rotation queue, advance, and voting tests"
```

---

### Task 4: Spotify Client

**Files:**
- Create: `src/spotify.ts`

- [ ] **Step 1: Implement Spotify client with token refresh**

```typescript
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/spotify.ts
git commit -m "feat: add Spotify Web API client with token refresh"
```

---

### Task 5: Discord Bot Setup + Command Registration

**Files:**
- Create: `src/discord.ts`

- [ ] **Step 1: Implement Discord client and slash command definitions**

```typescript
// src/discord.ts
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
} from 'discord.js';

export type CommandHandler = (interaction: ChatInputCommandInteraction) => Promise<void>;
export type ButtonHandler = (interaction: ButtonInteraction) => Promise<void>;

const commands = [
  new SlashCommandBuilder().setName('join').setDescription('Join the DJ rotation'),
  new SlashCommandBuilder().setName('leave').setDescription('Leave the DJ rotation'),
  new SlashCommandBuilder()
    .setName('add')
    .setDescription('Search and add a song to your DJ queue')
    .addStringOption(opt => opt.setName('query').setDescription('Song name or artist').setRequired(true)),
  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a song from your queue')
    .addIntegerOption(opt => opt.setName('index').setDescription('Song number in your queue (starting from 1)').setRequired(true)),
  new SlashCommandBuilder().setName('queue').setDescription('View your DJ queue'),
  new SlashCommandBuilder().setName('now').setDescription('Show the currently playing song'),
  new SlashCommandBuilder().setName('skip').setDescription('Vote to skip the current song'),
  new SlashCommandBuilder().setName('djs').setDescription('Show the DJ rotation'),
];

export async function registerCommands(clientId: string, token: string): Promise<void> {
  const rest = new REST().setToken(token);
  await rest.put(Routes.applicationCommands(clientId), {
    body: commands.map(c => c.toJSON()),
  });
  console.log('Slash commands registered');
}

export function createClient(): Client {
  return new Client({
    intents: [GatewayIntentBits.Guilds],
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/discord.ts
git commit -m "feat: add Discord client setup and slash command registration"
```

---

### Task 6: Commands — join, leave, djs

**Files:**
- Create: `src/commands/join.ts`
- Create: `src/commands/leave.ts`
- Create: `src/commands/djs.ts`

- [ ] **Step 1: Implement /join**

```typescript
// src/commands/join.ts
import type { ChatInputCommandInteraction } from 'discord.js';
import { Rotation } from '../rotation.js';

export function joinCommand(rotation: Rotation) {
  return async (interaction: ChatInputCommandInteraction) => {
    const added = rotation.join(interaction.user.id);
    if (added) {
      await interaction.reply(`🎧 **${interaction.user.displayName}** joined the DJ rotation! (${rotation.getDJs().length} DJs)`);
    } else {
      await interaction.reply({ content: 'You\'re already in the rotation!', ephemeral: true });
    }
  };
}
```

- [ ] **Step 2: Implement /leave**

```typescript
// src/commands/leave.ts
import type { ChatInputCommandInteraction } from 'discord.js';
import { Rotation } from '../rotation.js';

export function leaveCommand(rotation: Rotation) {
  return async (interaction: ChatInputCommandInteraction) => {
    const removed = rotation.leave(interaction.user.id);
    if (removed) {
      await interaction.reply(`👋 **${interaction.user.displayName}** left the DJ rotation. (${rotation.getDJs().length} DJs)`);
    } else {
      await interaction.reply({ content: 'You\'re not in the rotation.', ephemeral: true });
    }
  };
}
```

- [ ] **Step 3: Implement /djs**

```typescript
// src/commands/djs.ts
import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { Rotation } from '../rotation.js';

export function djsCommand(rotation: Rotation) {
  return async (interaction: ChatInputCommandInteraction) => {
    const djs = rotation.getDJs();
    if (djs.length === 0) {
      await interaction.reply('No DJs in the rotation. Use `/join` to start!');
      return;
    }

    const currentDJ = rotation.getCurrentDJ();
    const lines = djs.map(dj => {
      const marker = dj.userId === currentDJ?.userId ? '▶' : '　';
      const songCount = dj.queue.length;
      return `${marker} <@${dj.userId}> — ${songCount} song${songCount !== 1 ? 's' : ''} queued`;
    });

    const embed = new EmbedBuilder()
      .setTitle('🎶 DJ Rotation')
      .setDescription(lines.join('\n'))
      .setColor(0x1DB954);

    await interaction.reply({ embeds: [embed] });
  };
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/commands/join.ts src/commands/leave.ts src/commands/djs.ts
git commit -m "feat: add /join, /leave, /djs commands"
```

---

### Task 7: Commands — add, remove, queue

**Files:**
- Create: `src/commands/add.ts`
- Create: `src/commands/remove.ts`
- Create: `src/commands/queue.ts`

- [ ] **Step 1: Implement /add with search result buttons**

```typescript
// src/commands/add.ts
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { Rotation } from '../rotation.js';
import { SpotifyClient } from '../spotify.js';

export function addCommand(rotation: Rotation, spotify: SpotifyClient) {
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
      const track = { ...results[index], addedBy: interaction.user.id };

      if (!rotation.getDJs().some(dj => dj.userId === interaction.user.id)) {
        rotation.join(interaction.user.id);
      }

      rotation.addTrack(interaction.user.id, track);

      await btnInteraction.update({
        content: `✅ Added **${track.title}** — ${track.artist} to your queue`,
        embeds: [],
        components: [],
      });
    } catch {
      await interaction.editReply({ content: 'Selection timed out.', embeds: [], components: [] });
    }
  };
}
```

- [ ] **Step 2: Implement /remove**

```typescript
// src/commands/remove.ts
import type { ChatInputCommandInteraction } from 'discord.js';
import { Rotation } from '../rotation.js';

export function removeCommand(rotation: Rotation) {
  return async (interaction: ChatInputCommandInteraction) => {
    const index = interaction.options.getInteger('index', true) - 1;
    const removed = rotation.removeTrack(interaction.user.id, index);

    if (removed) {
      await interaction.reply(`🗑️ Removed **${removed.title}** — ${removed.artist} from your queue`);
    } else {
      await interaction.reply({ content: 'Invalid index. Check your queue with `/queue`.', ephemeral: true });
    }
  };
}
```

- [ ] **Step 3: Implement /queue**

```typescript
// src/commands/queue.ts
import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { Rotation } from '../rotation.js';

export function queueCommand(rotation: Rotation) {
  return async (interaction: ChatInputCommandInteraction) => {
    const queue = rotation.getQueue(interaction.user.id);

    if (queue.length === 0) {
      await interaction.reply({ content: 'Your queue is empty. Use `/add` to add songs!', ephemeral: true });
      return;
    }

    const lines = queue.map((t, i) => `**${i + 1}.** ${t.title} — ${t.artist}`);

    const embed = new EmbedBuilder()
      .setTitle(`🎵 Your DJ Queue`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: `${queue.length} song${queue.length !== 1 ? 's' : ''}` })
      .setColor(0x1DB954);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  };
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/commands/add.ts src/commands/remove.ts src/commands/queue.ts
git commit -m "feat: add /add, /remove, /queue commands"
```

---

### Task 8: Commands — now, skip + Now Playing Embed

**Files:**
- Create: `src/commands/now.ts`
- Create: `src/commands/skip.ts`

- [ ] **Step 1: Implement /now**

```typescript
// src/commands/now.ts
import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { Rotation } from '../rotation.js';
import { SpotifyClient } from '../spotify.js';

export function nowCommand(rotation: Rotation, spotify: SpotifyClient) {
  return async (interaction: ChatInputCommandInteraction) => {
    const current = rotation.getCurrentTrack();
    if (!current) {
      await interaction.reply('Nothing is playing right now. Add songs with `/add` and `/join` the rotation!');
      return;
    }

    const playback = await spotify.getCurrentlyPlaying();
    const votes = rotation.getVotes();
    const progressBar = playback ? formatProgress(playback.progressMs, playback.durationMs) : '';

    const embed = new EmbedBuilder()
      .setTitle(current.title)
      .setDescription(`by **${current.artist}**`)
      .addFields(
        { name: 'DJ', value: `<@${current.addedBy}>`, inline: true },
        { name: 'Votes', value: `🔥 ${votes.fire}　👎 ${votes.skip}`, inline: true },
      )
      .setColor(0x1DB954);

    if (current.albumArt) embed.setThumbnail(current.albumArt);
    if (progressBar) embed.addFields({ name: 'Progress', value: progressBar });

    await interaction.reply({ embeds: [embed] });
  };
}

function formatProgress(progressMs: number, durationMs: number): string {
  const progress = Math.floor(progressMs / 1000);
  const duration = Math.floor(durationMs / 1000);
  const barLength = 20;
  const filled = Math.round((progressMs / durationMs) * barLength);
  const bar = '▓'.repeat(filled) + '░'.repeat(barLength - filled);
  return `${formatTime(progress)} ${bar} ${formatTime(duration)}`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
```

- [ ] **Step 2: Implement /skip**

```typescript
// src/commands/skip.ts
import type { ChatInputCommandInteraction } from 'discord.js';
import { Rotation } from '../rotation.js';

export interface SkipCallbacks {
  onSkip: () => Promise<void>;
}

export function skipCommand(rotation: Rotation, callbacks: SkipCallbacks) {
  return async (interaction: ChatInputCommandInteraction) => {
    const current = rotation.getCurrentTrack();
    if (!current) {
      await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
      return;
    }

    const shouldSkip = rotation.voteSkip(interaction.user.id);
    const votes = rotation.getVotes();
    const needed = Math.floor(rotation.getDJs().length / 2) + 1;

    if (shouldSkip) {
      await interaction.reply(`⏭️ Skipped **${current.title}** (${votes.skip}/${needed} votes)`);
      await callbacks.onSkip();
    } else {
      await interaction.reply(`👎 ${interaction.user.displayName} voted to skip (${votes.skip}/${needed} needed)`);
    }
  };
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/commands/now.ts src/commands/skip.ts
git commit -m "feat: add /now and /skip commands with progress bar and voting"
```

---

### Task 9: Playback Poller

**Files:**
- Create: `src/poller.ts`

- [ ] **Step 1: Implement playback poller**

The poller checks Spotify every 5 seconds. When it detects the track has ended (or changed externally), it advances the rotation and plays the next song. It also posts a now-playing embed to the designated channel.

```typescript
// src/poller.ts
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/poller.ts
git commit -m "feat: add playback poller for track-end detection and now-playing posts"
```

---

### Task 10: Express Server (OAuth)

**Files:**
- Create: `src/server.ts`

- [ ] **Step 1: Implement Express server**

```typescript
// src/server.ts
import express from 'express';

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing';

export function createServer(clientId: string, clientSecret: string, port: number) {
  const app = express();
  const redirectUri = `http://localhost:${port}/callback`;

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/auth', (_req, res) => {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: SCOPES,
      redirect_uri: redirectUri,
    });
    res.redirect(`${SPOTIFY_AUTH_URL}?${params}`);
  });

  app.get('/callback', async (req, res) => {
    const code = req.query.code as string;
    if (!code) {
      res.status(400).send('Missing authorization code');
      return;
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });

    const tokenRes = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body,
    });

    if (!tokenRes.ok) {
      res.status(500).send('Token exchange failed');
      return;
    }

    const data = await tokenRes.json() as { refresh_token: string; access_token: string };

    res.send(`
      <h1>✅ Authorization Complete</h1>
      <p>Your refresh token:</p>
      <pre>${data.refresh_token}</pre>
      <p>Set this as <code>SPOTIFY_REFRESH_TOKEN</code> in your environment variables.</p>
    `);
  });

  return app.listen(port, () => {
    console.log(`HTTP server on port ${port}`);
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/server.ts
git commit -m "feat: add Express server for Spotify OAuth and health check"
```

---

### Task 11: Entry Point — Wire Everything Together

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Implement entry point**

```typescript
// src/index.ts
import { Events, type ChatInputCommandInteraction } from 'discord.js';
import { createClient, registerCommands, type CommandHandler } from './discord.js';
import { Rotation } from './rotation.js';
import { SpotifyClient } from './spotify.js';
import { Poller } from './poller.js';
import { createServer } from './server.js';
import { joinCommand } from './commands/join.js';
import { leaveCommand } from './commands/leave.js';
import { addCommand } from './commands/add.js';
import { removeCommand } from './commands/remove.js';
import { queueCommand } from './commands/queue.js';
import { nowCommand } from './commands/now.js';
import { skipCommand } from './commands/skip.js';
import { djsCommand } from './commands/djs.js';

const required = (name: string): string => {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env var: ${name}`);
  return val;
};

async function main() {
  const discordToken = required('DISCORD_TOKEN');
  const discordClientId = required('DISCORD_CLIENT_ID');
  const spotifyClientId = required('SPOTIFY_CLIENT_ID');
  const spotifyClientSecret = required('SPOTIFY_CLIENT_SECRET');
  const spotifyRefreshToken = required('SPOTIFY_REFRESH_TOKEN');
  const port = parseInt(process.env.PORT ?? '3000', 10);

  const rotation = new Rotation();
  const spotify = new SpotifyClient(spotifyClientId, spotifyClientSecret, spotifyRefreshToken);
  const client = createClient();
  const poller = new Poller(rotation, spotify, client);

  const commands: Record<string, CommandHandler> = {
    join: joinCommand(rotation),
    leave: leaveCommand(rotation),
    add: addCommand(rotation, spotify),
    remove: removeCommand(rotation),
    queue: queueCommand(rotation),
    now: nowCommand(rotation, spotify),
    skip: skipCommand(rotation, { onSkip: () => poller.playNext() }),
    djs: djsCommand(rotation),
  };

  client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {
      const handler = commands[interaction.commandName];
      if (handler) {
        try {
          await handler(interaction as ChatInputCommandInteraction);
        } catch (err) {
          console.error(`Command error (${interaction.commandName}):`, err);
          const reply = { content: 'Something went wrong.', ephemeral: true };
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply);
          } else {
            await interaction.reply(reply);
          }
        }
      }
    }

    if (interaction.isButton()) {
      const current = rotation.getCurrentTrack();
      if (!current) return;

      if (interaction.customId === 'vote_fire') {
        const added = rotation.voteFire(interaction.user.id);
        const votes = rotation.getVotes();
        await interaction.reply({
          content: added
            ? `🔥 ${interaction.user.displayName} likes this! (${votes.fire} 🔥)`
            : 'You already voted!',
          ephemeral: !added,
        });
      }

      if (interaction.customId === 'vote_skip') {
        const shouldSkip = rotation.voteSkip(interaction.user.id);
        const votes = rotation.getVotes();
        const needed = Math.floor(rotation.getDJs().length / 2) + 1;

        if (shouldSkip) {
          await interaction.reply(`⏭️ Skipped **${current.title}** (${votes.skip}/${needed} votes)`);
          await poller.playNext();
        } else {
          await interaction.reply(`👎 ${interaction.user.displayName} voted to skip (${votes.skip}/${needed} needed)`);
        }
      }
    }
  });

  client.once(Events.ClientReady, async c => {
    console.log(`Logged in as ${c.user.tag}`);

    const channel = c.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === 'music');
    if (channel) {
      poller.setChannel(channel.id);
    }

    poller.start();
  });

  await registerCommands(discordClientId, discordToken);
  await client.login(discordToken);

  createServer(spotifyClientId, spotifyClientSecret, port);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire up entry point — discord, spotify, poller, express"
```

---

### Task 12: Dockerfile, .env.example, README

**Files:**
- Create: `Dockerfile`
- Create: `.env.example`
- Create: `README.md`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: Create .env.example**

```env
# Discord
DISCORD_TOKEN=your-discord-bot-token
DISCORD_CLIENT_ID=your-discord-application-client-id

# Spotify (https://developer.spotify.com/dashboard)
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
SPOTIFY_REFRESH_TOKEN=your-spotify-refresh-token

# Server
PORT=3000
```

- [ ] **Step 3: Create README.md**

```markdown
# Office DJ Bot 🎵

A Discord bot that brings the JQBX experience to your office. Coworkers take turns as DJs, queue songs, and vote — all through Discord slash commands. Music plays on a shared device via Spotify.

## How It Works

- One Spotify Premium account controls playback on a shared device (smart speaker, etc.)
- Coworkers join a **DJ rotation** in Discord
- Each DJ queues their own songs — the bot plays them **round-robin**
- Everyone can vote 🔥 (love it) or 👎 (skip it)

## Commands

| Command | Description |
|---------|-------------|
| `/join` | Join the DJ rotation |
| `/leave` | Leave the DJ rotation |
| `/add <song>` | Search and add a song to your queue |
| `/remove <number>` | Remove a song from your queue |
| `/queue` | View your queued songs |
| `/now` | See what's currently playing |
| `/skip` | Vote to skip the current song |
| `/djs` | See the DJ rotation |

## Setup

### Prerequisites

- Node.js 20+
- A Discord bot token ([Discord Developer Portal](https://discord.com/developers/applications))
- A Spotify Developer app ([Spotify Developer Dashboard](https://developer.spotify.com/dashboard))
- A Spotify Premium account

### 1. Clone and install

```bash
git clone <your-repo-url>
cd office-dj-bot
npm install
```

### 2. Create a Discord bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to **Bot** → **Reset Token** → copy the token
4. Go to **OAuth2** → **URL Generator**
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Embed Links`, `Use Slash Commands`
5. Open the generated URL to invite the bot to your server

### 3. Create a Spotify app

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Set the redirect URI to `http://localhost:3000/callback`
4. Copy the **Client ID** and **Client Secret**

### 4. Get your Spotify refresh token

```bash
cp .env.example .env
# Fill in DISCORD_TOKEN, DISCORD_CLIENT_ID, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET
npm run build && node dist/index.js
```

1. Open `http://localhost:3000/auth` in your browser
2. Log in with your Spotify Premium account
3. Copy the refresh token from the page
4. Set `SPOTIFY_REFRESH_TOKEN` in your `.env` (or Zeabur env vars)

### 5. Run

```bash
npm run build
npm start
```

### 6. Start playing

1. Open Spotify on your device and start playing something (so the bot has an active device)
2. Cast to your office speaker
3. In Discord, run `/join` and `/add <song>` — the bot takes it from there

## Deploy to Zeabur

1. Push to a Git repo
2. Create a new project on [Zeabur](https://zeabur.com)
3. Add a **Git Service** pointing to your repo
4. Set the environment variables in the Zeabur dashboard
5. Done — the bot will auto-deploy on push

## Tech Stack

- TypeScript + Node.js
- [discord.js](https://discord.js.org/) — Discord bot framework
- [Spotify Web API](https://developer.spotify.com/documentation/web-api) — Playback control
- Express — OAuth callback server

## License

MIT
```

- [ ] **Step 4: Commit**

```bash
git add Dockerfile .env.example README.md
git commit -m "docs: add Dockerfile, .env.example, and README"
```

---

### Task 13: Final Integration Test

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Build the project**

Run: `npm run build`
Expected: No errors, `dist/` directory created

- [ ] **Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "chore: fix any build issues from integration"
```
