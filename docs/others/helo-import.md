# HeLO calendar import

Import Circle and Circle Jr competitive/scrim history from the public HeLO `/v3` API into Tactika calendar events.

**Teams**

| UI label | `match.team` | HeLO `tag` | Import flag |
|----------|--------------|------------|-------------|
| Circle | `sr` | `Circle` | `--team Circle` (default) |
| Circle Jr | `jr` | `◯` (U+25EF) | `--team jr` or `--team circle-jr` |

Both teams share one player pool (`roster_members` / Comp Roster). Events store which org played via `match.team`.

**Status (Jul 2026):** Shipped on v2 (`hll-tactika-test`). Remote D1 has Circle series matches with Circle-side `participantSteamIds`. UI: **Records → My matches**, Hub **My matches**, Match Brief **You played**, create-event **Team** selector (Circle / Circle Jr).

## Quick start

```bash
# Dry-run all Circle matches (series 2024)
npm run import:helo

# Dry-run Circle Jr (HeLO tag ◯)
npm run import:helo:jr

# Pilot one match
npm run import:helo:pilot

# Competitive only
node scripts/import-helo-history.mjs --type competitive

# Apply to a running Tactika (editor session required)
set TACTIKA_BASE_URL=http://127.0.0.1:8788
set TACTIKA_SESSION_COOKIE=hll-tactika-session=...
node scripts/import-helo-history.mjs --only Circle-PF-2026-07-12 --apply
node scripts/import-helo-history.mjs --apply

# Or write directly into local / remote D1 (no session cookie)
node scripts/import-helo-history.mjs --only Circle-PF-2026-07-12 --apply --local-d1
node scripts/import-helo-history.mjs --apply --local-d1
node scripts/import-helo-history.mjs --team jr --apply --local-d1
node scripts/import-helo-history.mjs --team jr --apply --remote-d1
node scripts/import-helo-history.mjs --apply --remote-d1
```

Re-runs are safe: events with the same `match.heloMatchId` are skipped.
Circle vs Circle Jr friendlies share one HeLO id — whichever team is imported first keeps the event (usually senior Circle as `sr`).

Import fetches per-match HeLO details by default so `participantSteamIds` and `player_match_stats` land in one pass. Use `--no-details` for a faster metadata-only dry-run.

## Mapping

See [`scripts/lib/helo-mapper.mjs`](../scripts/lib/helo-mapper.mjs). Events store:

- `eventType`: `comp` / `scrim`
- `match.team`: `sr` (Circle) or `jr` (Circle Jr)
- `match.opponent`, `mapId`, `faction`, `result` (`win`/`loss`)
- `match.heloMatchId`, `match.heloUrl`
- `match.participantSteamIds` (our-side Steam64 from HeLO `player_stats`)
- Optional: `match.crconGameId`, `match.crconUrl` (allowlisted Circle stats hosts)
- Score + tournament text in `description`
- Titles: `Comp vs …` / `Jr Comp vs …` (and Scrim equivalents)

Backfill `match.team` on older imports:

```bash
node scripts/backfill-match-team.mjs --local-d1
node scripts/backfill-match-team.mjs --apply --remote-d1
```

## Player participation (Steam ID → My matches)

HeLO `player_stats` (and CRCON scoreboards) use **Steam ID64**. Tactika stores our-side IDs on each event as `match.participantSteamIds`. Logged-in users see **My matches** on Records / Hub when their auth Steam ID is in that list.

```bash
npm run backfill:helo-participants          # dry-run
npm run backfill:helo-participants:local    # write local D1
node scripts/backfill-helo-participants.mjs --apply --remote-d1
```

## Player combat stats (slim snapshot)

HeLO import (`--local-d1` / `--remote-d1`) also writes our-side rows into `player_match_stats` (kills, deaths, combat/support/off/def points, playtime, kpm). Backfill existing events:

```bash
npm run backfill:helo-player-stats
npm run backfill:helo-player-stats:local
node scripts/backfill-helo-player-stats.mjs --apply --remote-d1
```

Management Overview **Player form** merges these aggregates when present.

## Roster seeding (shared pool)

Add HeLO participants into Comp Roster (`roster-default`) without granting site access:

```bash
node scripts/seed-roster-from-helo-events.mjs --local-d1
node scripts/seed-roster-from-helo-events.mjs --apply --remote-d1 --team jr
```

**Roster spreadsheets** are useful Steam ID references only. Do **not** auto-grant Tactika site access from them — many entries are mercs, leavers, Epic/Game Pass IDs, nicknames, or incomplete Steam64s:

- [ECL roster 2026.1](https://docs.google.com/spreadsheets/d/1QvnsG-LQmMXoT5BgcfgJKVkdAOL5To5HekJ5Jgk87PQ/edit)
- [Circle Comp | Rosters](https://docs.google.com/spreadsheets/d/1GZv4Q-xILC7ry8ESXjN3cqYEimxco6PRwYxgDGywz3Q/edit?gid=521785014) (recruit form; mixed Steam64 / Epic / names)

Management **Import from Sheets** pulls both published CSVs into **ECL Roster** and **Comp Roster** (Steam64 only; upgrades `Player ####` placeholders). Re-click to refresh — still never grants site access.

## Phase 2 — CRCON enrichment (browser session works)

Public CRCON bases:

| Server | Base |
|--------|------|
| Circle 1 | `https://stats1.the-circle.team` |
| Circle 4 | `https://stats4.the-circle.team` |

API (after Cloudflare cookie from a real browser session):

- `GET /api/get_scoreboard_maps?page=N&page_size=100` — historical games (`id`, `start`, `end`, `map`, `result.{allied,axis}`)
- Game URL: `{base}/games/{id}`

**Matching rule that works:** same calendar day + map alias + **HeLO score aligned to Circle faction** (`result` on CRCON). Prefer score match over start-time proximity — HeLO `date` is often closer to report/end than CRCON map start.

Pilot results on **stats4** (high confidence):

| HeLO | CRCON |
|------|-------|
| Circle-PF-2026-07-12 (PHL 4-1 Axis) | https://stats4.the-circle.team/games/96379 |
| Circle-PF-2026-06-27 (Hurtgen 4-1 Allies) | https://stats4.the-circle.team/games/94969 |
| Circle-HTD-2026-06-14 (Omaha 4-1 Allies) | https://stats4.the-circle.team/games/93643 |
| Circle-GID-2026-05-31 (SME 3-2 Axis) | https://stats4.the-circle.team/games/92348 |
| Circle-82AD-2026-05-24 (SMDM 3-2 Axis) | https://stats4.the-circle.team/games/91690 |

Notes:

- CLI/`curl` gets **403** (Cloudflare). Browser `fetch` after loading the site works.
- Event nights we sampled lived on **stats4**; stats1 had no day/map hits for those comps in a 12-page window.
- Some HeLO matches still miss (e.g. CHMA Stalingrad 2026-06-27) — wrong box, missing CRCON row, or score/layout mismatch.

Do **not** scrape HLLRecords `/matches/:id` for mass import; use CRCON game ids as the durable link.

## Notes

- `--local-d1` may auto-repair a missing `event_type` column on older local DBs (schema drift from early migrations).
- Prefer `--local-d1` / `--remote-d1` for bulk backfill; use HTTP `--apply` when you already have an editor session cookie.
- On Windows, remote D1 reads use wrangler’s JS entrypoint + `--command=…` (remote `--file` SELECTs often return a summary instead of rows).
- Circle Jr HeLO page: https://helo-system.de/teams/%E2%97%AF?series=2024
- Related: feature summary [`tactika-features-summary.md`](./tactika-features-summary.md) · tracker [#33](https://github.com/Djurre1981/hll-tactika-test/issues/33)
