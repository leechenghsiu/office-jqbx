# Office DJ Bot

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
