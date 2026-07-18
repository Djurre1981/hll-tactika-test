# Tactika v2.0 – AI Agent Context

## Project Overview
- **HLL Tactika** – Steam-authenticated web app for Hell Let Loose community.
- **v1** (climbing guide) remains self-contained in `climbing-guide-v1/` (js + css co-located). Do **not** modify after relocation.
- **v2** is a React SPA adding dashboard, calendar, team management, strat browser/editor, and micro-prep whiteboard/slideshow.
- **Goal:** Keep collaborative drawing smooth, stay within Cloudflare free tier, keep code AI‑friendly.
- **Collab / Yjs:** Phase 8 — Render Node process (`server/`) + CF `/api/rooms/*` + client `src/lib/collab/`.

## Directory Map
```
root
├── climbing-guide-v1/   # Vanilla v1 – do NOT modify (owns its js/ + css/)
├── map-kernel/          # Pure JS drawing engine – no React imports
├── functions/           # Cloudflare Pages Functions (REST API)
├── server/              # Render Yjs WebSocket + (later) Discord bot
├── public/              # Static assets (maps/, assets/, data/)
├── src/                 # React SPA
│   ├── app/             # Top-level shell, router, providers
│   ├── features/        # Feature‑scoped code
│   │   ├── auth/
│   │   ├── home/        # Hub shell + dashboard home (+ presence)
│   │   ├── calendar/
│   │   ├── team/
│   │   ├── management/  # Roster + folders (Phase 5)
│   │   ├── strats/
│   │   │   ├── browser/
│   │   │   └── editor/
│   │   └── micro-prep/
│   ├── shared/
│   ├── lib/             # includes lib/collab/ (Yjs provider + hooks)
│   └── styles/
├── migrations/
└── scripts/
```

## Technology Stack
- **React 18** (function components + hooks)
- **Vite** (MPA – React at `/`, climbing guide at `/climbing-guide-v1/`)
- **React Router v6**, **TanStack Query v5**, **Zustand**, **Tailwind CSS**
- **Cloudflare D1 / KV / R2**
- **Map Kernel** – aliased as `@map-kernel`

## Data Layer Rules (Phase 0+)
- Prefer **D1 row-level** reads/writes over rewriting whole JSON blobs in KV.
- Use `functions/lib/d1.js` (`getDb` / `requireDb`) to access `env.DB`.
- Keep slide drawing `objects` as JSON text columns until Yjs owns them.
- Do **not** store Yjs CRDT snapshots in D1 — those stay in KV.
- Schema changes go through `migrations/*.sql` and `npm run db:migrate:*`.
- Follow `docs/migration-plan.md` and `docs/migration-roadmap.md`.

## Core Rules & Conventions

### Feature‑First Organization
- Every business feature lives in `src/features/<name>/`.
- Feature folders contain own `hooks/`, components, pages.
- `shared/` is for truly generic UI – never put business logic there.
- `lib/` holds cross‑cutting utilities (API client, query key factories, stores).

### Map Kernel Isolation
- **Never import `@map-kernel` into a React component directly.**
- Always use a thin wrapper (e.g., `CanvasWrapper`) that communicates via Zustand + ref.
- The kernel must remain React‑agnostic.

### Data Fetching
- All server data goes through TanStack Query.
- Query keys defined in `src/lib/query-keys.js`.
- API base URL: `/api/`.

### State Management
- **Server state → TanStack Query.** **UI state → Zustand** under `src/lib/stores/` (e.g. `useToolStore`, `useEditorStore`).

### Styling
- Use Tailwind utility classes for layout/spacing/color.
- Keep `styles/globals.css` minimal – Tailwind directives, glass helpers, hub chrome keyframes.
- Auth welcome/bye CSS is co-located under `src/features/auth/`.

### API Client
- `src/lib/api-client.js` wraps `fetch` with auth cookie handling.

### File Naming
- PascalCase for React components; camelCase for hooks; kebab/camel for utilities.
- Prefer files under ~250 lines; extract hooks / subcomponents.

## Agent Instructions
- Prefer extending an existing feature folder over inventing new top-level areas.
- Never modify `climbing-guide-v1/` (frozen after cleanup relocation).
- Before modifying `map-kernel/`, keep it vanilla JS with no React dependency.
- No barrel files — import directly from the source file.
- No cross‑feature imports — use `shared/` or an explicit public API.
- Collab: Yjs snapshots in KV (`yjs:{roomId}`); never store CRDT blobs in D1. Room join via `POST /api/rooms/join`; WS on Render `/collab`.
