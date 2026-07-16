# Tactika v2.0 – AI Agent Context

## Project Overview
- **HLL Tactika** – Steam-authenticated web app for Hell Let Loose community.
- **v1** (climbing guide) remains untouched in `climbing-guide-v1/`.
- **v2** is a React SPA adding dashboard, calendar, team management, strat browser/editor with live collaboration, and micro-prep whiteboard.
- **Goal:** Keep collaborative drawing smooth, stay within Cloudflare free tier, keep code AI‑friendly.

## Directory Map
root
├── climbing-guide-v1/ # Vanilla v1 – do NOT modify
├── map-kernel/ # Pure JS drawing engine – no React imports
├── functions/ # Cloudflare Pages Functions (REST API)
├── src/ # React SPA
│ ├── app/ # Top-level shell, router, providers
│ ├── features/ # Feature‑scoped code (one folder per feature)
│ │ ├── auth/
│ │ ├── dashboard/
│ │ ├── calendar/
│ │ ├── team/
│ │ ├── strats/
│ │ │ ├── browser/ # Folder tree, list
│ │ │ └── editor/ # Canvas wrapper, toolbar, slides, properties
│ │ └── micro-prep/
│ ├── shared/ # Reusable UI components (Button, Modal, etc.)
│ ├── lib/ # API client, query keys, Zustand stores, constants
│ └── styles/ # Tailwind + global resets
├── data/ # Static seed data (map-spawns.json, etc.)
├── public/ # Static assets (maps, fonts, icons)
└── scripts/ # Dev & deploy helpers

## Technology Stack
- **React 18** (function components + hooks)
- **Vite** (MPA config – v1 and v2 as separate entries)
- **React Router v6** (nested routes)
- **TanStack Query v5** for server state (caching, refetch)
- **Zustand** for client UI state (tool, camera, UI toggles)
- **Tailwind CSS** (utility-first)
- **Yjs** + `y-websocket` for real-time collaboration (Phase 6+)
- **Map Kernel** – imperative vanilla JS module, aliased as `@map-kernel`

## Core Rules & Conventions

### Feature‑First Organization
- Every business feature lives in `src/features/<name>/`.
- Feature folders contain own `hooks/`, components, pages.
- `shared/` is for truly generic UI – never put business logic there.
- `lib/` holds cross‑cutting utilities (API client, query key factories, stores).

### Map Kernel Isolation
- **Never import `@map-kernel` into a React component directly.**
- Always use a thin wrapper (e.g., `CanvasWrapper`) that communicates via:
  - Zustand stores for tools/camera.
  - A ref and imperative API for drawing operations.
- The kernel must remain React‑agnostic; it will later talk to Yjs directly.

### Data Fetching
- All server data goes through TanStack Query.
- Query keys defined in `src/lib/query-keys.js` – use factories like `pins.byMap(mapId)`.
- Mutations use `useMutation` with optimistic updates and cache invalidation.
- Default stale time: 5 minutes; refetch on window focus.
- API base URL: `/api/`.

### State Management
- **Server state → TanStack Query.** Do not duplicate in local state.
- **UI state → Zustand.** Stores are defined in `src/lib/stores/`.
  - `useToolStore` (current drawing tool, color, stroke width)
  - `useCameraStore` (pan x/y, zoom)
  - `useUIStore` (sidebar, modals, etc.)
- No prop‑drilling beyond 2 levels.

### Styling
- Use Tailwind utility classes exclusively for layout/spacing/color.
- For complex animations, use `framer-motion`; no CSS modules unless absolutely necessary.
- Keep `styles/globals.css` minimal – Tailwind directives and CSS custom properties for the dark palette.

### API Client
- `src/lib/api-client.js` wraps `fetch` with auth cookie handling and error normalization.
- All frontend API calls must use this client.

### File Naming
- PascalCase for React components: `StratEditor.jsx`.
- camelCase for hooks: `useStratEditor.js`.
- kebab-case or camelCase for utilities: `query-keys.js`, `api-client.js`.

## Adding a New Feature
1. Create folder: `src/features/<name>/`.
2. Add page component, any sub‑components, and a `hooks/` folder.
3. If data comes from server, add query key to `query-keys.js` and hook in feature’s `hooks/`.
4. Add route in `src/app/router.jsx`.
5. If new API endpoint needed, add handler in `functions/api/`.

## Collaboration (Yjs) – When Implemented
- Yjs document structure: Y.Map for slides (keys = slide IDs), each slide has Y.Array of objects.
- The kernel will directly read/write Yjs types – do not bridge through React state.
- Awareness (cursors) will be displayed on canvas, not in React.

## Agent Instructions
- When asked to implement something, first check if it fits into an existing feature folder. If yes, extend it; if no, create a new feature folder following conventions.
- Prefer short files (under ~250 lines). Extract hooks or sub‑components aggressively.
- Never modify `climbing-guide-v1/`.
- Before modifying `map-kernel/`, understand that it must remain vanilla JS and cannot depend on React.
- Use existing patterns: look at how `useTeamQuery.js` is structured for API calls, or how `CanvasWrapper.jsx` mounts the kernel.
- Keep the code short when possible