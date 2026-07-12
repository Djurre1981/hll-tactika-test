HLL Tactika Folder Structure

Repo layout for the HLL Tactika platform. The first release is the interactive climb and MG guide module.
See also: [project-overview.md](project-overview.md), [roles.md](roles.md).

├── index.html                       # SPA shell — welcome/bye boot screens + app chrome; imports js/app.js
├── package.json                     # Node project manifest — Cloudflare Pages static site with Wrangler
├── package-lock.json                # Locked dev dependency versions (Wrangler)
├── wrangler.toml                    # Cloudflare Pages + Workers config (KV namespace, build output dir)
├── README.md
├── .dev.vars                        # Local dev secrets (gitignored)
├── .dev.vars.example                # Template for local dev secrets
├── .gitignore
│
├── docs/
│   ├── user-guide.md                # Member & editor guide (pins, colours, workflows)
│   ├── folder-structure.md          # This file — repo layout reference
│   ├── project-overview.md          # Architecture, stack, and feature knowledge base
│   ├── roles.md                     # Role hierarchy and permission matrix
│   ├── api.md                       # REST API reference
│   └── data-schemas.md              # KV, pin/user schemas, static data files
│
├── assets/
│   ├── fonts/                       # Texta / TextaAlt font files (.ttf)
│   ├── logos/                       # Faction SVGs (axis, allies, neutral) + Tactika branding
│   └── welcome/                     # Welcome and logout screen videos (welcome.mp4, bye.mp4)
│
├── css/
│   ├── base.css                     # CSS variables (dark theme), reset, typography, button base styles
│   ├── layout.css                   # Main app grid layout: sidebar + map area + header
│   ├── utilities.css                # Utility classes: .sr-only, .flex-center, etc.
│   ├── fonts/
│   │   └── texta.css                # @font-face declarations for Texta font family
│   ├── components/
│   │   ├── glass.css                # Glass-morphism input/button surfaces
│   │   ├── auth-gate.css            # Steam login overlay / gate
│   │   ├── welcome-page.css         # Pre-auth welcome screen (video scrub + typewriter)
│   │   ├── bye-page.css             # Post-logout farewell screen
│   │   ├── mode-switch.css          # Viewer / Editor mode toggle
│   │   ├── user-menu.css            # User avatar dropdown and logout
│   │   ├── map-viewer.css           # Map viewport, stage, zoom controls
│   │   ├── map-overlays.css         # Grid lines and strongpoint overlay labels
│   │   ├── sidebar.css              # Sidebar panel with pin list, map selector, filters
│   │   ├── filter-bar.css           # Faction and tag filter buttons
│   │   ├── pin-marker.css           # Pin marker icons on the map
│   │   ├── pin-preview.css          # Hover tooltip preview
│   │   ├── pin-modal.css            # Detail modal with multi-media carousel
│   │   ├── pin-editor.css           # Add/Edit pin form in sidebar
│   │   ├── context-menu.css         # Right-click pin context menu
│   │   ├── mg-spot-arrows.css       # SVG arrow indicators for MG spots
│   │   └── admin-panel.css          # Admin user management dialog
│   └── editor/
│       └── editor.css               # Editor mode: crosshair, draft marker, undo/redo indicator
│
├── js/
│   ├── app.js                       # Bootstrap: init core, auth, and UI components
│   ├── bind-ui.js                   # Centralized DOM event binding for all UI interactions
│   ├── state.js                     # Global mutable state object + localStorage persistence helpers
│   ├── pin-tags.js                  # Pin tag constants: mg-spot, climb — validation and utilities
│   ├── api/
│   │   ├── auth.js                  # Auth API: login check, logout, current user cache
│   │   ├── pins.js                  # Pin CRUD API: create, read, update, delete
│   │   ├── maps.js                  # Map data API: fetch spawn/strongpoint data
│   │   └── admin.js                 # Admin API: list users, add/remove members
│   ├── ui/
│   │   ├── auth-gate.js             # Auth overlay: login prompt, session check, welcome flow init
│   │   ├── welcome-scrub.js         # Mouse-scrubbed welcome video playback
│   │   ├── welcome-typewriter.js    # Typewriter intro text on welcome screen
│   │   ├── chrome-panels.js         # Portrait sidebar/toolbar collapse helpers
│   │   ├── map-viewer.js            # Pan/zoom engine (MapViewer class)
│   │   ├── map-overlays.js          # Draw grid lines + strongpoint labels on map
│   │   ├── map-bg-fade.js           # Map background color/hue tint controls
│   │   ├── map-picker.js            # Map selector dropdown population
│   │   ├── filter-bar.js            # Faction/tag filter state management and UI sync
│   │   ├── sidebar.js               # Pin list rendering and sidebar pin management
│   │   ├── pin-marker.js            # Create pin DOM elements on the map layer
│   │   ├── pin-preview.js           # Hover tooltip with thumbnail preview
│   │   ├── pin-modal.js             # Detail modal with multi-media carousel player
│   │   ├── pin-editor.js            # Add/edit form panel in sidebar
│   │   ├── pin-context-menu.js      # Right-click context menu (edit/delete)
│   │   ├── editor-toast.js          # Brief editor feedback toasts (undo/redo in browse)
│   │   ├── mg-spot-arrows.js        # SVG arrow construction for directional MG spots
│   │   ├── admin-panel.js           # Admin user management UI
│   │   └── toggles.js               # Grid/strongpoints toggle state management
│   ├── editor/
│   │   ├── placement-mode.js        # Click-to-place, viewport context menu, draft form routing
│   │   ├── pin-drag.js              # Browse + draft pin drag (climb + MG handles)
│   │   ├── undo-redo.js             # Ctrl+W/Y position undo/redo stack
│   │   ├── draft-renderer.js        # Live preview marker while placing a pin
│   │   ├── media-form.js            # Multi-media URL rows in pin editor form
│   │   └── form-handler.js          # Collect form data, validate, save/delete pins
│   ├── helpers/
│   │   ├── permissions.js           # Client-side pin modification permission check (role-based)
│   │   ├── position-code.js         # Grid position code generator (e.g. #M78-58)
│   │   ├── pin-media.js             # Multi-media pin helpers: detect kind, normalize items
│   │   ├── pin-persist.js           # Persist browse drag moves via API + catalog sync
│   │   ├── mg-placement.js          # MG head/bar min-separation validation helpers
│   │   ├── sanitizer.js             # HTML escaping for safe rendering
│   │   ├── proximity.js             # Pin highlight, label positioning, map pin layout
│   │   └── constants.js             # MG label direction per map, faction direction helpers
│   └── utils/
│       ├── video.js                  # URL normalization, embed builder, video element creation
│       └── medal.js                  # Medal.tv clip resolver (proxied through backend API)
│
├── maps/
│   ├── no-grid/                     # 20 tactical map images (1920x1920 WebP) — one per HLL map
│   ├── plain-grid.png               # Grid overlay image
│   └── points/                      # Strongpoint highlight images per map (SP_NoMap.png variants)
│
├── data/
│   ├── map-spawns.json              # All 20 maps: strongpoint coordinates and grid data
│   ├── pins.json                    # Seed pin data — built-in tricks per map (shipped with code)
│   └── strongpoint-names.json       # Strongpoint name labels per sector
│
├── scripts/
│   ├── deploy-cloudflare.ps1        # PowerShell: create Pages project, upload secrets, deploy
│   ├── extract-map-data.py          # Python: extract map spawn/strongpoint data from maps-let-loose
│   └── extract-sp-names.py          # Python: extract strongpoint name labels from PNG cutouts (Pillow)
│
└── functions/
    ├── _middleware.js               # Global middleware: blocks direct access to /data/pins.json
    ├── api/
    │   ├── pins.js                  # GET /api/pins (list all), POST /api/pins (create)
    │   ├── pins/[pinId].js          # PUT /api/pins/:id (update), DELETE /api/pins/:id
    │   │
    │   ├── auth/
    │   │   ├── steam.js             # GET /api/auth/steam — redirect to Steam OpenID
    │   │   ├── callback.js          # GET /api/auth/callback — Steam OpenID callback handler
    │   │   ├── me.js                # GET /api/auth/me — current user session check
    │   │   └── logout.js            # POST /api/auth/logout — clear session cookie
    │   │
    │   ├── admin/
    │   │   ├── users.js             # GET /api/admin/users (list), POST (add user)
    │   │   └── users/[steamId].js   # DELETE /api/admin/users/:id, PATCH (role change)
    │   │
    │   └── medal/
    │       └── resolve.js           # GET /api/medal/resolve?url= — proxy Medal.tv API
    │
    └── lib/
        ├── allowlist.js             # Re-exports from roles.js (backward compat)
        ├── auth-request.js          # requireAuth / requireAdmin / requireOwner middleware
        ├── medal.js                 # Medal.tv clip resolution logic (API + scrape fallback)
        ├── pin-creators.js          # Enrich pins with creator display names
        ├── pin-permissions.js       # Server-side pin modification permission check
        ├── pins-store.js            # Pin data CRUD: Cloudflare KV (prod) or in-memory (dev)
        ├── response.js              # Helper: json(), redirect(), errorResponse()
        ├── roles.js                 # Role hierarchy: owner > admin > user
        ├── session.js               # HMAC-signed session cookie management (7-day TTL)
        ├── steam.js                 # Steam OpenID authentication + profile fetching
        └── users-store.js           # User data (allowlist) CRUD in KV/in-memory
