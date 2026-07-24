# StratMaker Architecture Plan

This document defines the target architecture for StratMaker as it evolves from a single‑purpose strategy board into a collaborative operations platform. The plan is designed to maximise developer productivity, runtime performance, AI‑assisted development, and long‑term maintainability, while keeping infrastructure costs at zero dollars per month for the foreseeable future.

## Contents
1. High-Level Architecture
2. Frontend Architecture
3. State Management
4. Live Collaboration
5. Backend & Database
6. Persistence Strategy
7. Project Structure
8. Migration Roadmap
9. Architecture Rationale
---

# 1. High-Level Architecture

```text
Browser                             Cloudflare Pages          Oracle VM (or Render)
┌───────────────────────┐          ┌────────────────┐        ┌────────────────────┐
│ React SPA (stratmaker)│ ◄─REST─► │ Functions      │        │ Node.js Yjs Server │
│  ┌─────────────────┐  │          │  /api/*        │        │ (y-websocket)      │
│  │ React UI panels │  │          │                │        │  ┌───────────────┐ │
│  │ + Map Kernel    │  │          │  D1 (SQLite)   │        │  │ Y.Doc per room│ │
│  └────────┬────────┘  │          │  KV (Yjs blobs)│        │  │ Awareness     │ │
│           │           │          │  R2 (media)    │        │  └──────┬────────┘ │
│           │WebSocket  │          └──────┬─────────┘        │         │          │
│           └───────────┼─────────────────┘                  │         │          │
│                       │  wss://c ollab.tactika.gg          │         │          │
└───────────────────────┘                                    └─────────┼──────────┘
                                                                       │
                                                            Cloudflare Functions (auth bridge)
                                                            POST /api/rooms/join → JWT
                                                            PUT  /api/rooms/:id/save → KV
                                                            GET  /api/rooms/:id/load → KV
```

## Overview

* **React SPA** powers the StratMaker application while the Climbing Guide remains on the existing vanilla implementation.
* The **Map Kernel** stays as an imperative Canvas/SVG module to avoid unnecessary React rendering overhead.
* **Yjs** provides real-time collaborative editing through a dedicated WebSocket server.
* **Cloudflare Functions** handle authentication, REST APIs, and JWT generation.
* **Cloudflare D1** stores structured application data.
* **Cloudflare KV** stores serialized Yjs snapshots.
* **Cloudflare R2** stores media assets.
---

# 2. Frontend Architecture

## Technology Stack
| Concern        | Technology         | Reason                                        |
| -------------- | ------------------ | --------------------------------------------- |
| UI Framework   | React 18           | Mature ecosystem and declarative UI           |
| Routing        | React Router v6    | Nested layouts and route composition          |
| Server State   | TanStack Query v5  | Caching, deduplication, background refetching |
| Client State   | Zustand            | Lightweight and usable outside React          |
| Styling        | Tailwind CSS       | Fast development and AI-friendly              |
| Drawing Engine | Vanilla JavaScript | Existing performant implementation            |
| Collaboration  | Yjs + y-websocket  | Proven CRDT implementation                    |

## Component Hierarchy
```text
<App>
 └── AuthGate
      └── QueryClientProvider
           └── RoomProvider
                └── AppShell
                     ├── Sidebar
                     │    ├── MapSelector
                     │    ├── SlideList
                     │    └── StratFolderTree
                     │
                     ├── MainArea
                     │    ├── Toolbar
                     │    ├── MapCanvas
                     │    └── CollaborationCursors
                     │
                     └── PropertiesPanel
```

Additional application sections such as the Dashboard, Team Management, and Calendar reuse the same `AppShell` through React Router layouts.
---

# 3. State Management

## Server State
TanStack Query owns all data retrieved from the backend, including:
* Users
* Teams
* Strats
* Pins
* Preferences

Typical hooks:
```ts
usePins(mapId)
useStrats()
useUsers()
```

Recommended defaults:
* **Stale Time:** 5 minutes
* Background refetch on window focus
* Automatic cache invalidation after mutations
---

## Local UI State

Zustand manages application UI state.
Example slices:

```text
useTool
 ├── tool
 └── setTool
useCamera
 ├── x
 ├── y
 └── zoom
useUI
 ├── sidebarOpen
 └── toggleSidebar
```
Because Zustand exists independently of React, the Map Kernel can subscribe directly:
```js
store.subscribe(state => {
    if (state.tool !== this.currentTool) {
        this.setTool(state.tool);
    }
});
```
---

## Collaborative State

During an editing session, the **Y.Doc** becomes the single source of truth.

Workflow:
1. Map Kernel reads from the Y.Doc.
2. User edits the document.
3. Kernel writes changes back into the Y.Doc.
4. Updates synchronize automatically across all connected clients.
5. React components observe the document for UI updates.
6. Completed edits are periodically serialized into snapshots.

---

# 4. Live Collaboration

## WebSocket Server
A dedicated Node.js server hosts collaborative rooms.

Responsibilities:

* One `Y.Doc` per room
* Broadcast CRDT updates
* Authenticate clients
* Persist snapshots
* Maintain awareness information
* Snapshots are saved

## Authentication Flow

### `POST /api/rooms/join`
Request:
```json
{
  "roomId": "..."
}
```
Process:
1. Validate user session.
2. Verify room permissions.
3. Generate short-lived JWT.
4. Return:
```json
{
  "token": "...",
  "wsUrl": "wss://collab.tactika.gg"
}
```
---

## Room Lifecycle

### Join
* Request JWT
* Connect to WebSocket
* Authenticate
* Load room state

### Editing
* All drawing updates flow through Yjs.
* No database writes occur during active editing.

### Save
* Merge updates
* Compress document
* Persist snapshot to KV

### Auto Save
After 30 seconds of inactivity.

### Disconnect
When the final user leaves:
* Save snapshot
* Keep room in memory for five minutes
* Remove inactive room afterwards

# 5. Backend & Database

## SQL Database
* Row-level updates
* SQL queries
*  indexing
* Reduced write amplification
* Future analytics and reporting

## KV Responsibilities
KV  responsible only for:
* Serialized Yjs snapshots
* Temporary collaboration state
---

# 6. Project Structure
```text
project-root/
│
├── .dev.vars                    # Local secrets (gitignored)
├── .dev.vars.example
├── wrangler.toml                # Cloudflare Pages + Functions config
├── package.json
├── vite.config.js               # Vite with React + MPA support
│
├── climbing-guide-v1/           # Existing vanilla app, entirely untouched (lives outside src/)
│   ├── index.html
│   ├── css/
│   ├── js/
│   ├── assets/
│   └── ...
│
├── functions/                   # Cloudflare Pages Functions (serverless API)
│   ├── _middleware.js
│   └── api/
│       ├── auth/...
│       ├── pins/...
│       ├── strats/...
│       ├── collab/...           # New endpoints for Yjs tokens, rooms
│       └── uploads/...
│
├── map-kernel/                  # Pure vanilla JS module – never imported into React
│   ├── MapViewer.js            # DOM-based map pan/zoom
│   ├── CanvasRenderer.js       # Renders scene graph onto overlay canvas
│   ├── SceneGraph.js           # Retained object model (pre‑Yjs)
│   └── index.js                # Single export: MapKernel class
│
├── public/                      # Static assets served at root
│   ├── favicon.ico
│   ├── maps/                    # 1920x1920 WebP map images
│   └── assets/
│       ├── fonts/
│       ├── logos/
│       └── icons/
│
├── src/                         # React SPA (everything else)
│   ├── ai-context.md            # Agent instructions + directory map (read first)
│   │
│   ├── app/                     # Top‑level shell
│   │   ├── App.jsx
│   │   ├── router.jsx
│   │   └── providers/
│   │       └── query-client.jsx
│   │
│   ├── features/                # Feature‑scoped code
│   │   ├── auth/
│   │   │   ├── AuthGate.jsx
│   │   │   └── UserMenu.jsx
│   │   │
│   │   ├── dashboard/
│   │   │   ├── DashboardPage.jsx
│   │   │   └── StatCard.jsx
│   │   │
│   │   ├── calendar/
│   │   │   └── CalendarPage.jsx       # Placeholder for now
│   │   │
│   │   ├── team/
│   │   │   ├── TeamPage.jsx
│   │   │   ├── RosterTable.jsx
│   │   │   └── hooks/
│   │   │       └── useTeamQuery.js
│   │   │
│   │   ├── strats/
│   │   │   ├── browser/
│   │   │   │   ├── StratList.jsx
│   │   │   │   └── FolderTree.jsx
│   │   │   │
│   │   │   └── editor/
│   │   │       ├── StratEditor.jsx
│   │   │       ├── Toolbar.jsx
│   │   │       ├── SlideList.jsx
│   │   │       ├── PropertiesPanel.jsx
│   │   │       ├── CanvasWrapper.jsx
│   │   │       └── hooks/
│   │   │           └── useStratEditor.js
│   │   │
│   │   └── micro-prep/
│   │       └── Whiteboard.jsx
│   │
│   ├── shared/                  # Truly reusable UI components
│   │   ├── Button.jsx
│   │   ├── Modal.jsx
│   │   └── Spinner.jsx
│   │
│   ├── lib/                     # Cross‑cutting utilities
│   │   ├── api-client.js        # fetch wrapper with auth
│   │   ├── query-keys.js        # TanStack Query key factories
│   │   ├── stores/              # Zustand slices (one per store)
│   │   │   ├── useToolStore.js
│   │   │   ├── useCameraStore.js
│   │   │   └── useUIStore.js
│   │   └── constants.js
│   │
│   └── styles/
│       ├── globals.css          # Tailwind directives + a few global resets
│       └── tailwind.config.js
│
├── data/                        # Static seed data (same as v1)
│   ├── map-spawns.json
│   ├── strongpoint-names.json
│   └── map-midpoints.json
│
└── scripts/                     # Dev & deploy helpers
    ├── deploy-cloudflare.ps1
    └── run-dev.mjs
```

## Conventions
* No barrel files — import directly from the source file.
* Feature co‑location — all code for a feature lives inside features/<name>/.
* Files ≤ 200 lines — split if longer; the agent must read any file in one context window.
* No cross‑feature imports — use shared/ or an explicit public API.
* Shared UI only in shared/ — buttons, modals, spinners, etc.
* map-kernel/ is pure vanilla JS — never imports React.
* Zustand slices one per file — useToolStore.js, useCameraStore.js, each under 50 lines.
* TanStack Query key factories — all keys from lib/query-keys.js.
* Tailwind only — no CSS modules unless unavoidable; custom CSS is co‑located.
* Legacy climbing guide lives outside src/ — untouched by the React build.
---
