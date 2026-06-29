# Discord → R2 video migration

One-time pipeline to move climbing-guide videos off expiring Discord CDN links into **Cloudflare R2**, then point pins at permanent app URLs (`/api/videos/{messageId}`).

## Prerequisites

1. **Cloudflare account** with Wrangler logged in: `npx wrangler login`
2. **R2 buckets** (run once from repo root):

   ```powershell
   npx wrangler r2 bucket create hll-climb-videos
   npx wrangler r2 bucket create hll-climb-videos-preview
   ```

3. **R2 API token** — Cloudflare Dashboard → R2 → Manage R2 API Tokens → Object Read & Write on `hll-climb-videos`
4. **Discord bot** in your server with:
   - **Message Content Intent** enabled (Discord Developer Portal)
   - **Read Message History** permission in `#climbing-guide`
   - Bot token and channel ID

5. **Pages R2 binding** — after first deploy with updated `wrangler.toml`, attach the `VIDEOS_R2` binding in Cloudflare Pages → Settings → Functions if the dashboard prompts you.

## Setup

```powershell
cd scripts/video-migration
copy .env.example .env
# Fill in DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID, CLOUDFLARE_ACCOUNT_ID, R2 keys
npm install
```

## Run pipeline

From `scripts/video-migration`:

```powershell
node 1-export-discord.mjs    # manifest.json from channel
node 2-download-videos.mjs   # data/videos/*.mp4
node 3-upload-r2.mjs         # upload to R2
node 4-apply-kv.mjs          # rewrite pin videoUrl in production KV
```

Or from repo root:

```powershell
npm run migrate:videos:export
npm run migrate:videos:download
npm run migrate:videos:upload
npm run migrate:videos:apply
```

Steps are **resumable** — re-running skips completed downloads/uploads.

## How pins are matched (step 4)

A pin is updated when any of these match a manifest entry:

- `pin.sourceDiscordMessageId`
- Discord attachment id embedded in `pin.videoUrl`
- Exact Discord attachment URL prefix (before `?`)

Updated pins get:

- `videoUrl`: `/api/videos/{discordMessageId}`
- `sourceDiscordMessageId`: `{discordMessageId}`

## App behavior

- Videos are served at **`GET /api/videos/:videoId`** (circle members only, same Steam session as pins).
- R2 object key: `tricks/{messageId}.mp4`
- Free tier: 10 GB-month storage; ~400 short clips usually fits or costs pennies/month.

## Data layout

```
scripts/video-migration/
  data/
    manifest.json      # gitignored — export state
    videos/            # gitignored — downloaded mp4s
```

## After migration

- New tricks: upload to R2 (or use `/api/videos/…` URLs) — **do not** paste Discord CDN links.
- Optional: remove Discord URL support from the pin form once migration is complete.
