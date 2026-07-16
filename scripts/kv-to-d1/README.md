# KV → D1 one-time migration (Phase 0)

Lead roadmap (DeepSeek): migrate existing KV **`pins`** and **`users`** into D1 with a one-time script. Keep KV blobs as backup.

## Prerequisites

```bash
npm run db:migrate:remote
npm run db:migrate:preview   # if using preview
```

## Usage

```bash
# Preview SQL only (no writes)
node scripts/kv-to-d1/migrate.mjs --dry-run --remote

# Apply to production D1 (reads production KV)
node scripts/kv-to-d1/migrate.mjs --remote

# Apply to preview D1 (reads preview KV)
node scripts/kv-to-d1/migrate.mjs --remote --preview
```

## What it does

1. Reads KV keys `pins` and `users` from `PINS_KV`
2. Writes JSON backups under `data/kv-d1-backup/`
3. Upserts rows into D1 tables `pins`, `users`, `revoked_users`
4. **Does not** delete or overwrite KV keys

## Out of scope (per Phase 0 script scope)

- Strats / slides (later phase once editor uses D1)
- Events / teams (empty tables until Phase 3 / team features)
