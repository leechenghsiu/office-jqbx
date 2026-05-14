# Office JQBX

A Discord bot that lets your office share a Spotify queue. Anyone can add songs or playlists through Discord — music plays on a shared device like a smart speaker.

## How It Works

- One Spotify Premium account controls playback on a shared device (smart speaker, etc.)
- `/start-jam` to pick a device and start the session
- Anyone can `/add` songs or `/add-playlist` entire playlists to the shared queue
- When the queue runs out, Spotify autoplay kicks in — music never stops
- `/stop-jam` when done — your Spotify account is released

## Commands

| Command | Description |
|---------|-------------|
| `/start-jam` | Start the Jam — pick a Spotify device to play on |
| `/stop-jam` | Stop the Jam |
| `/add <song>` | Search and add a song to the queue |
| `/add-artist <artist>` | Add 10 songs by an artist to the queue |
| `/queue` | View the current queue |
| `/now` | See what's currently playing |
| `/skip` | Skip the current song |

## Setup

### Prerequisites

- Node.js 20+
- A Discord bot token ([Discord Developer Portal](https://discord.com/developers/applications))
- A Spotify Developer app ([Spotify Developer Dashboard](https://developer.spotify.com/dashboard))
- A Spotify Premium account

### 1. Clone and install

```bash
git clone https://github.com/leechenghsiu/office-jqbx.git
cd office-jqbx
npm install
```

### 2. Create a Discord bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to **Bot** → **Reset Token** → copy the token
4. Go to **Installation** → Default Install Settings → Guild Install
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Embed Links`, `Use Slash Commands`
5. Copy the install link and open it to invite the bot to your server

### 3. Create a Spotify app

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Set the redirect URI to `http://127.0.0.1:3000/callback` (for local) or `https://your-app.zeabur.app/callback` (for cloud)
4. Copy the **Client ID** and **Client Secret**

### 4. Get your Spotify refresh token

You can get the refresh token in two ways:

**Option A: Cloud setup (Zeabur)**

1. Deploy the service with only `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and `BASE_URL` set
2. The bot starts in setup mode — visit `https://your-app.zeabur.app/auth`
3. Authorize with your Spotify Premium account
4. Copy the refresh token and add it as `SPOTIFY_REFRESH_TOKEN` in Zeabur env vars
5. Add `DISCORD_TOKEN` and `DISCORD_CLIENT_ID`, the service restarts and goes live

**Option B: Local setup**

```bash
cp .env.example .env
# Fill in SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET
npm run build && node dist/index.js
```

1. Open `http://127.0.0.1:3000/auth` in your browser
2. Log in with your Spotify Premium account
3. Copy the refresh token from the page
4. Set `SPOTIFY_REFRESH_TOKEN` in your `.env`

> The refresh token does not expire unless you revoke the app or change your Spotify password.

### 5. Run

```bash
npm run build
npm start
```

### 6. Start playing

1. Open Spotify on any device (phone, laptop, smart speaker)
2. In Discord, run `/start-jam` and select the device
3. `/add <song>` or `/add-playlist <link>` to queue music

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | Yes | Discord bot token |
| `DISCORD_CLIENT_ID` | Yes | Discord application client ID |
| `SPOTIFY_CLIENT_ID` | Yes | Spotify app client ID |
| `SPOTIFY_CLIENT_SECRET` | Yes | Spotify app client secret |
| `SPOTIFY_REFRESH_TOKEN` | Yes* | Spotify OAuth refresh token (*not needed for initial setup mode) |
| `BASE_URL` | No | Public URL for OAuth callback (e.g. `https://your-app.zeabur.app`) |
| `PORT` | No | HTTP server port (default: `3000`) |

## Deploy to Zeabur

[![Deploy on Zeabur](https://zeabur.com/button.svg)](https://zeabur.com/templates/office-jqbx)

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
