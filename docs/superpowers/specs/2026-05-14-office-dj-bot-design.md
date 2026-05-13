# Office DJ Bot — Design Spec

## Overview

A Discord bot that replicates the JQBX experience for an office environment. Coworkers join a DJ rotation, queue songs, and vote — the bot controls Spotify playback on a shared device (smart speaker) via the Spotify Web API using one Premium account.

## Architecture

Single Node.js service containing:

- **Discord.js client** — handles slash commands and button interactions
- **Spotify API client** — controls playback, search, queue management
- **Token Manager** — stores refresh token (env var), auto-refreshes access token in memory
- **Express server (minimal)** — `/auth` (initiate OAuth), `/callback` (receive token), `/health`
- **Rotation engine** — in-memory DJ rotation, per-DJ queues, voting state

No database. All state is in memory and resets on restart.

## Commands

| Command | Description |
|---------|-------------|
| `/join` | Join the DJ rotation |
| `/leave` | Leave the DJ rotation |
| `/add <query>` | Search Spotify, pick from top 5 results via buttons, add to your DJ queue |
| `/remove <index>` | Remove a song from your queue by index |
| `/queue` | View your DJ queue |
| `/now` | Show currently playing song + who queued it + vote status |
| `/skip` | Vote to skip current song (majority of DJs = skip) |
| `/djs` | Show DJ rotation order and who's up |

## DJ Rotation Logic

- DJs are stored in an ordered list
- A pointer tracks the current DJ
- When a song ends, advance to the next DJ who has songs queued
- If a DJ's queue is empty, skip them
- If all queues are empty, pause and notify the channel
- `/add` without `/join` auto-joins the user

## Voting

- When a song starts, bot posts an embed with 🔥 and 👎 buttons
- 👎 votes exceeding 50% of active DJs triggers auto-skip
- 🔥 is cosmetic (shows appreciation)
- Each user can only vote once per song

## `/add` Interaction Flow

1. User runs `/add <query>`
2. Bot searches Spotify, returns top 5 results as an embed with numbered buttons
3. User clicks a button to select
4. Song is added to the user's DJ queue
5. Bot confirms with song title and artist

## Edge Cases

| Scenario | Handling |
|----------|----------|
| DJ queue empty, still in rotation | Skip to next DJ |
| All queues empty | Post "No songs queued" message, wait |
| Only one DJ | Play their songs continuously |
| `/add` without `/join` | Auto-join |
| Spotify device offline | Reply "Spotify is not active on any device" |
| Search returns nothing | Reply "No results found" |
| Token refresh failure | Post notification asking for re-auth |

## Tech Stack

- TypeScript + Node.js
- discord.js
- Spotify Web API (direct fetch or @spotify/web-api-ts-sdk)
- Express (minimal)

## Environment Variables

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REFRESH_TOKEN`

## Project Structure

```
office-dj-bot/
├── src/
│   ├── index.ts
│   ├── discord.ts
│   ├── commands/
│   │   ├── join.ts
│   │   ├── leave.ts
│   │   ├── add.ts
│   │   ├── remove.ts
│   │   ├── queue.ts
│   │   ├── now.ts
│   │   ├── skip.ts
│   │   └── djs.ts
│   ├── spotify.ts
│   ├── rotation.ts
│   └── server.ts
├── package.json
├── tsconfig.json
├── Dockerfile
├── .env.example
└── README.md
```

## Deployment

- Deploy to Zeabur as a single service
- Dockerfile or Node.js buildpack
- Environment variables configured in Zeabur dashboard
- One-time OAuth setup to obtain refresh token
