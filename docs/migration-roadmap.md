# Tactika v2.0 Migration Roadmap

## Phase 0 – Infrastructure
- [x] Provision D1 databases (`hll-tactika-db` + preview) and bind `DB` on Pages
- [x] Apply foundation schema (`migrations/0001_init_schema.sql`)
- [ ] Migrate KV data (pins / users / strats) into D1
- [ ] Deploy Y‑WebSocket server
- [ ] Add collab API endpoints (join, save)
- [x] Create staging environment (`hll-tactika-test`)
- [x] Write ai-context.md

## Phase 1 – React Shell
- Configure Vite MPA
- Install Router, Query, Zustand, Tailwind
- Define all routes, scaffold pages
- Build shared UI primitives
- Alias map-kernel, enforce no direct React imports

## Phase 2 – Auth & Team
- Move auth to D1
- AuthGate + UserMenu
- Team page with roster table
- Role‑gated UI and API

## Phase 3 – Dashboard & Calendar
- Dashboard stat cards
- Calendar month view + event CRUD
- Loading/empty/error states

## Phase 4 – Strat Browser
- Add folders table + folder_id to strats
- Folder tree with drag‑and‑drop
- Filterable strat list
- Update GET /api/strats

## Phase 5 – Strat Editor (no collab)
- CanvasWrapper mounts kernel via ref
- Toolbar, slide list, properties panel
- D1 load/save with auto‑save
- Port all drawing tools, undo/redo

## Phase 6 – Live Collaboration
- useYjsRoom hook (JWT → WS)
- Sync Y.Doc objects with kernel
- Remote cursors via awareness
- KV snapshots on idle/save/teardown

## Phase 7 – Micro‑Prep Whiteboard
- Full‑page whiteboard + background upload
- Kernel extensions: sticky notes, highlighter
- D1 board CRUD, optional Yjs sync

## Folder Reviews
- After Phase 1 – validate feature‑folder layout
- At Phase 5 start – check editor subtree for Yjs readiness