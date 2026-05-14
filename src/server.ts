import express from 'express';

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing';

export function createServer(clientId: string, clientSecret: string, port: number, baseUrl?: string) {
  const app = express();
  const redirectUri = baseUrl ? `${baseUrl}/callback` : `http://127.0.0.1:${port}/callback`;

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
