# Collab server (Render) + env checklist

Node process for Yjs WebSockets. Phase 9 Discord bot can share this process later.

## Local

```bash
cd server
npm install
# Use the same COLLAB_* values as ../.dev.vars
set COLLAB_JWT_SECRET=...
set COLLAB_PERSIST_SECRET=...
set API_BASE_URL=http://127.0.0.1:8788/api/rooms
npm start
```

Health: `GET http://localhost:4080/health`  
WS: `ws://localhost:4080/collab?room=...&token=...`

## Render dashboard (existing service)

| Setting | Value |
|---|---|
| Root Directory | `server` |
| Build Command | `npm install` |
| Start Command | `node server.js` |
| Health Check Path | `/health` |

### Env vars on Render

| Key | Value |
|---|---|
| `COLLAB_JWT_SECRET` | Same as `.dev.vars` / Cloudflare |
| `COLLAB_PERSIST_SECRET` | Same as `.dev.vars` / Cloudflare |
| `API_BASE_URL` | `https://hll-tactika-test.pages.dev/api/rooms` |
| `DISCORD_TOKEN` | Phase 9 – Discord bot token (optional now) |
| `DISCORD_CLIENT_ID` | Phase 9 |
| `DISCORD_GUILD_ID` | Phase 9 optional test guild |
| `D1_API_KEY` | Unused in Phase 8 – leave empty |

### Env vars on Cloudflare Pages

| Key | Value |
|---|---|
| `COLLAB_JWT_SECRET` | Identical to Render |
| `COLLAB_PERSIST_SECRET` | Identical to Render |
| `COLLAB_WS_URL` | `wss://hll-tactika-test.onrender.com` |

Redeploy Pages after setting secrets.

Optional: `render.yaml` at repo root for Blueprint sync.
