# D1 migrations

Phase 0 foundation for the KV → SQL migration. See [migration-plan.md](../docs/migration-plan.md) and [migration-roadmap.md](../docs/migration-roadmap.md).

## Databases

| Environment | Name | Binding |
|-------------|------|---------|
| Production / local | `hll-tactika-db` | `DB` |
| Preview | `hll-tactika-db-preview` | `DB` (via `preview_database_id`) |

Configured in `wrangler.toml`.

## Commands

```bash
npm run db:migrate:local    # apply pending migrations to local D1
npm run db:migrate:remote   # apply to production D1
npm run db:migrate:preview  # apply to preview D1
```

Create a new migration:

```bash
npx wrangler d1 migrations create hll-tactika-db "short_description"
```

## What lives where

| Store | Responsibility |
|-------|----------------|
| **D1** | Users, pins, strats metadata, slides (objects as JSON text), strat_folders, teams, events, room metadata |
| **KV** | Yjs collaboration snapshots only (pins/users KV blobs kept as backup after Phase 0 migrate) |
| **R2** | Uploaded videos / images |

## KV → D1 data load

```bash
npm run db:migrate-kv:dry   # preview
npm run db:migrate-kv       # upsert pins + users from KV into D1
```

See `scripts/kv-to-d1/README.md`.
