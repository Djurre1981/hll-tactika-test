# Wiki source (`docs/wiki`)

Canonical member manual. Same pages power:

1. **In-app help** (avatar **?** overlay)
2. **GitHub wiki** — https://github.com/Djurre1981/hll-tactika-test/wiki

## Sync

```bash
npm run wiki:push   # docs/wiki → GitHub wiki
npm run wiki:pull   # GitHub wiki → docs/wiki
```

Requires `git` and push access to `Djurre1981/hll-tactika-test.wiki.git`.

## Conventions

- Flat page names with hyphens (`Calendar-and-Match-Brief.md`) — GitHub wiki titles.
- `_Sidebar.md` drives both GitHub sidebar and in-app nav.
- Images live in `media/` and are referenced as `media/filename.png`.
- Prefer task-based how-tos over dumping every feature flag.
