# Tactika v2.0 Migration Roadmap

## Phase 0 – Infrastructure & Free‑Tier Foundation *(3‑5 days)*

**Goal:** Provision all backend services and migrate existing data to D1.

- [x] Create D1 database with tables: `pins`, `users`, `strats`, `events`, `teams`, `strat_folders`
- [x] Migrate existing KV `pins` and `users` data into D1 with a one‑time script
- [x] Bind D1 and R2 to the Pages project in `wrangler.toml`
- [ ] ~~Deploy Y‑WebSocket server on Oracle Always Free / Render free tier (Node.js, `y-websocket`, TLS)~~ *(skipped for now — revisit in Phase 8)*
- [ ] ~~Add `functions/api/collab/join.js` – session‑validated JWT minting for room access~~ *(skipped for now — revisit in Phase 8)*
- [ ] ~~Add `functions/api/collab/save.js` – binary snapshot persistence to KV namespace `COLLAB_SNAPSHOTS`~~ *(skipped for now — revisit in Phase 8)*
- [x] Create staging environment (Cloudflare Pages preview deployments, separate D1 preview)
- [x] Write initial `src/ai-context.md`

## Phase 1 – React Shell
- [x] Configure Vite MPA (React at `/`, `climbing-guide-v1/`, legacy stratmaker)
- [x] Install Router, Query, Zustand, Tailwind
- [x] Define all routes, scaffold pages
- [x] Build shared UI primitives
- [x] Alias map-kernel, enforce no direct React imports
- Note: `home/` is deprecated in favor of the React SPA at `/`

## Phase 2 – Auth & Team
- [x] Move auth to D1
- [x] AuthGate + UserMenu
- [x] Team page with roster table
- [x] Role‑gated UI and API

## Phase 3 – Dashboard & Calendar
- [x] Dashboard stat cards
- [x] Calendar month view + event CRUD
- [x] Loading/empty/error states

## Phase 4 – Bug fixes & Welcome/bye pages
- [x] WelcomePage with video scrub + typewriter hooks
- [x] ByePage (v1 parity) with scrub, typewriter, and actions
- [x] AuthGate restructured for public vs protected routes
- [x] Session/cache edge cases and dashboard query key stabilization

## Phase 5 – Strat Browser
- Add folders table + folder_id to strats
- Folder tree with drag‑and‑drop
- Filterable strat list
- Update GET /api/strats

## Phase 6 – Strat Editor (no collab)
- CanvasWrapper mounts kernel via ref
- Toolbar, slide list, properties panel
- D1 load/save with auto‑save
- Port all drawing tools, undo/redo

## Phase 7 – Micro‑Prep Whiteboard
- Full‑page whiteboard + background upload
- Kernel extensions: sticky notes, highlighter
- D1 board CRUD, optional Yjs sync

## Phase 8 – Live Collaboration
- useYjsRoom hook (JWT → WS)
- Sync Y.Doc objects with kernel
- Remote cursors via awareness
- KV snapshots on idle/save/teardown
