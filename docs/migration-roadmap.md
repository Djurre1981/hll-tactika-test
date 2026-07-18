# Tactika v2.0 Migration Roadmap

## Phase 0 – Infrastructure & Free‑Tier Foundation *(3‑5 days)*

**Goal:** Provision all backend services and migrate existing data to D1.

- [x] Create D1 database with tables: `pins`, `users`, `strats`, `events`, `teams`, `strat_folders`
- [x] Migrate existing KV `pins` and `users` data into D1 with a one‑time script
- [x] Bind D1 and R2 to the Pages project in `wrangler.toml`
- [x] Create staging environment (Cloudflare Pages preview deployments, separate D1 preview)
- [x] Write initial `src/ai-context.md`

## Phase 1 – React Shell
- [x] Configure Vite MPA (React at `/`, `climbing-guide-v1/` self-contained)
- [x] Install Router, Query, Zustand, Tailwind
- [x] Define all routes, scaffold pages
- [x] Build shared UI primitives
- [x] Alias map-kernel, enforce no direct React imports
- Note: Climbing Guide stays under `climbing-guide-v1/`; hub lives at `src/features/home/`

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

## Phase 5 – Strat Browser + management section
- [x] Add folders table + folder_id to strats
- [x] Add management section
- [x] Add management roster (clan roster, separate from site access)
- [x] Add management left bar
- [x] Folder tree with drag‑and‑drop
- [x] Filterable strat list
- [x] Update GET /api/strats

## Phase 6 – Strat Editor (no collab)
- [x] D1 `strats` table + store rewrite (KV reserved for Yjs)
- [x] CanvasWrapper mounts kernel via ref
- [x] Legacy-shell UI redo (Tailwind): left tools, full-bleed map, right slides
- [x] Dashboard opens `/tool/stratmaker` and auto-creates a D1 strat
- [x] Inset-aware map fit/zoom + grid/strongpoint overlays in map-kernel
- [x] D1 load/save with auto‑save
- [x] Port drawing tools, undo/redo, clipboard (canvas renderer)

## Phase 7 – Micro‑Prep Whiteboard
- [x] Full‑page Excalidraw whiteboard (not map-kernel)
- [x] Glass tools panel matching Stratmaker (`shared/glassUi.js`)
- [x] D1 `whiteboards` CRUD + debounced scene autosave
- [x] Background image upload via R2 (`/api/uploads/image`)
- [x] Sticky / highlighter via Excalidraw tools (no kernel extensions)
- [x] Mode chooser (Whiteboard / Slideshow) on `/tool/micro-prep`
- [x] Slideshow: 16:9 letterboxed stage + right slides panel + multi-slide scene


## Phase 8 – Live Collaboration
- [x] Deploy Y‑WebSocket server + `rooms/join` + `rooms/save|load`
- [x] useYjsRoom hook (JWT → WS)
- [x] Sync Y.Doc objects with kernel / Excalidraw
- [x] Remote peer presence via awareness (dashboard + editors)
- [x] KV snapshots on idle/save/teardown

## Phase 9 - Discord Bot
Build D1 tables & Cloudflare API endpoints.
Deploy Discord.js bot with /link commands.
Add /event create modal with persistence.
Handle signup/cancel buttons with role checks.
Post & auto-refresh rich embed updates.
Schedule recurring events and reminders.
Implement /post now and scheduled posts.
Sync web dashboard, deploy to Hetzner with PM2.
