# HLL Tactika

Developed by The Circle community and kept strictly exclusive to our competitive team. The platform is a tailored strategy and planning platform for Hell Let Loose designed to scale as our team needs grow. 

Its first release features an interactive climb and MG guide. A second module, **Strats**, adds map-based tactical planning with multi-slide presentations and drawing tools similar to StratSketch, plus Hell Let Loose–specific placeables (garrisons, outposts, vehicles, and more) sized like Maps Let Loose. **Routeplanner** adds timed transport-truck routes with accessibility-aware pathfinding on the same tactical maps.

Inspired by [Maps Let Loose](https://mattw.io/maps-let-loose/) for map selection, overlays, and default spawn data.

## Cloudflare media hosting

Trick **videos** and **preview images** can be uploaded from the editor panel. Files are stored in **Cloudflare R2** and served only to signed-in circle members:

- `POST /api/uploads/video` → `GET /api/videos/{id}`
- `POST /api/uploads/image` → `GET /api/images/{id}`

Supported uploads: **MP4, WebM, MOV, OGG** (video) and **JPEG, PNG, WebP, GIF** (preview). If no preview exists after a video upload, the first frame is captured automatically.

External links (YouTube, Medal.tv, Vimeo, Discord, etc.) still work alongside uploaded media.

### R2 setup (one-time)

```powershell
npx wrangler r2 bucket create hll-climb-videos
npx wrangler r2 bucket create hll-climb-videos-preview
```

After deploy, confirm the `VIDEOS_R2` binding is attached in **Cloudflare Pages → Settings → Functions**.

This module came as a solution to MG prep problems. Years of trick videos/spots are scattered across PDFs, local drives and chat threads... Hard to navigate through and therefore rarely used. HLL Tactika puts everything in one place on a map we all understand, making guides easy to access and raising the team's baseline knowledge.

Furthermore, access is fully controlled: Steam sign-in, an approved-member allowlist, and role-based permissions ensure our material stays internal. No more leaked or problems sharing guides with our members.


## Current module features: Interactive Climbing Guide

- All 20 tactical maps with pan/zoom on high-resolution maps
- Grid and strongpoint overlays
- Pin types: **climb** and **MG spot**
- Faction tagging (Axis / Allies / Neutral) and tag filters
- Hover a pin to preview; click to play full video (YouTube, Vimeo, MP4, Medal.tv, Discord attachments, Cloudflare-hosted uploads)
- Upload videos and preview images to Cloudflare R2 from the editor (or paste external links)
- Multi-media pins with image/video carousel
- Viewer and Editor modes: place pins on the map, drag, undo/redo
- **Steam sign-in** with role-based allowlist
- **Role-based permissions**: Comp Member, Comp Advisor, Comp Assist, Comp Admin, Owner. See [docs/roles.md](docs/roles.md)
- Protected pin data served only to authenticated, approved users
- Admin panel for member management

## Strats mode (map-based planning)

Strats mode is a team-internal planning workspace for drawing attack routes, defensive lines, rally points, and callouts directly on tactical maps. Each **strat** is a saved document with metadata, notes, and one or more **slides** (like slides in a deck). Every slide can use a different map and holds its own vector drawings.

Open **Strats** from the app (catalog / editor). Drawing tools live in the left sidebar; strat metadata, slide list, and the active slide editor live in the right panel. Map overlay toggles sit in the bottom chrome.

### Strat documents

| Field | Description |
|-------|-------------|
| **Title** | Display name shown in the catalog and header |
| **Team** | `jr` or `sr` (Junior / Senior) |
| **Type** | `friendly` or `tournament` |
| **Folder** | Optional catalog folder (drag-and-drop in the Strats browser) |
| **Notes** | Free-text notes for the whole strat |
| **Match** | Optional match metadata (map, opponent, etc.) |
| **Slides** | Ordered list of map views with drawings |
| **Locked** | When locked, drawings cannot be edited (view-only) |

The **Strats browser** lists strats with folder filtering and search. Inside the editor, create/rename/duplicate/import from the side panel. Changes auto-save after a short debounce when collab is offline; with live collab connected, the slide syncs over Yjs and autosave to the API is paused. Unsaved local edits still warn when leaving the page or switching strats.

Strats (and folders) are stored in **Cloudflare D1**. Authenticated members can browse; editor roles can create and edit. **StratSketch import** is available from the editor (paste a StratSketch code / link).

### Slides

Each slide has a **name**, **map**, and **objects** array (drawings). Slides can be:

- **Added**, **renamed** (double-click name in list), and **deleted**
- **Reordered** with drag-and-drop or up/down buttons
- **Navigated** with prev/next buttons on the map, keyboard arrows (when no shape is selected), or by clicking in the slide list
- **Duplicated** to another strat or into a **new strat** (duplicate dialog with search)
- Previewed via **thumbnails** rendered from slide objects

Opening a slide switches the map if its `mapId` differs from the current view.

### Drawing tools

Tools are in the left sidebar. All coordinates are map percentages (0–100) so drawings stay aligned when panning and zooming.

| Tool | Use |
|------|-----|
| **Select** | Click to select; drag to move; edit with handles |
| **Pen** | Freehand stroke |
| **Line** | Straight segment; optional arrowheads via **End type** |
| **Curved line** | Cubic Bézier (two endpoints + two control points); optional arrowheads |
| **Rectangle** | Box shape (filled or outline) |
| **Circle** | Ellipse / circle |
| **Text** | Click map, enter label; double-click selected text to edit |
| **Icons** | Place StratSketch-style tactical markers with optional label |
| **HLL Objects** | Place Hell Let Loose markers (garrisons, OPs, vehicles, classes, …) |
| **Ping** | Animated highlight rings on the map |
| **Eraser** | Click a shape to remove it |

**Right-click** on the map cancels an in-progress draw and switches to **Select** (CAD-style finish).

**Color** — preset swatches plus a custom color picker apply to the active tool or the current selection.

**Stroke options** (pen, line, curve): size, solid/dashed/dotted. **End type** (line, curve): none / start / end / both arrowheads.

**Shape options** (rectangle, circle): size, border style, filled toggle.

**Text options**: font size, regular/bold/italic, left/center/right alignment.

**Icon options**: pick from the expanded StratSketch-compatible palette (~75 icons, including letter/number circles). Multi-layer icons use knockout fills so letters and details stay readable in the toolbar and on the map. Icons place as a resizable bounding box (same handle model as rectangles).

**HLL Objects** — game-specific placeables inspired by [Maps Let Loose](https://mattw.io/maps-let-loose/), using the HLL logo as the tool icon. Grouped as Spawn, Vehicle, Class, Buildable, Placeable, Marker, and Ability. Marker sizes follow Maps Let Loose’s 1920×1920 tacmap scale. Assets live under `public/assets/hll-objects/` as scalable SVGs (regenerate with `npm run vectorize:hll-objects` from the PNG sources).

- **Show spawn radius** (map chrome): toggles lockout/radius art on spawn markers already on the slide (and for new placements).
- **Radius check** (HLL tool options, garrison): mouse-follow preview turns green/red; invalid garrison placements are blocked.

### Map chrome

Bottom-center toolbar on the strat map:

| Control | Effect |
|---------|--------|
| **Reset view** | Fit the map to the viewport |
| **Grid** | Toggle grid overlay |
| **Strongpoints** | Toggle strongpoint overlay |
| **Show spawn radius** | Toggle HLL spawn radius art (see above) |

### Drawing modifiers (Shift / Alt)

| Modifier | Effect |
|----------|--------|
| **Shift** (while drawing line/curve) | Snap angle to 45° increments (endpoints) |
| **Shift** (while drawing rect/circle) | Keep square / perfect circle |
| **Alt** (while drawing rect/circle) | Draw from center |
| **Shift** (while dragging selection) | Lock movement to horizontal or vertical |
| **Shift** (while resizing corner handle) | Proportional resize (icons / HLL stay 1:1) |

### Selection, handles, and editing

With **Select** active, click a shape to select it:

- **8 box handles** on rectangles, circles, freehand, text, icons, HLL objects, and pings (dashed outline)
- **2 endpoint handles** on lines (including lines with arrowheads)
- **4 Bézier handles** on curved lines (endpoints + control points; zoom-aware hit size)

While selected, the sidebar shows that object’s properties (color, stroke, fill, etc.). Edits apply live.

**Selection actions** (sidebar buttons or shortcuts):

| Action | Shortcut |
|--------|----------|
| Copy | **Ctrl+C** |
| Cut | **Ctrl+X** |
| Paste | **Ctrl+V** |
| Duplicate | **Ctrl+D** |
| Delete | **Delete** / **Backspace** |
| Nudge | **Arrow keys** (when a shape is selected) |
| Undo / Redo | **Ctrl+Z** / **Ctrl+Y** (or **Ctrl+Shift+Z**) |

Paste and duplicate offset copies slightly so repeated pastes do not stack on top of each other. Copy/cut/paste use an in-app clipboard (works across slides in the same session).

### Live collaboration

When another editor is on the same slide, Stratmaker joins a Yjs collab room (peers shown in the editor chrome). Object edits sync live on that slide. Presence is also announced on the site-wide online list.

### Strats API

All routes require Steam auth. Create/update/delete require editor role.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/strats` | List all strats (catalog) |
| `POST` | `/api/strats` | Create strat |
| `PUT` | `/api/strats/{stratId}` | Update strat |
| `DELETE` | `/api/strats/{stratId}` | Delete strat |
| `POST` | `/api/strats/{stratId}/duplicate` | Duplicate entire strat |
| `POST` | `/api/strats/{stratId}/slides/{slideId}/duplicate` | Duplicate slide (optionally into another strat) |

Slide payloads include a sanitized `objects[]` array. Supported object types: `pen`, `line`, `curve`, `rect`, `ellipse`, `text`, `icon`, `hll`, `ping`. Legacy `arrow` objects are normalized to `line` with an end arrowhead. Server-side validation lives in `functions/lib/strat-fields.js` and `functions/lib/strat-objects.js`.

Related APIs: folders (`/api/folders`), StratSketch import (`/api/strats/import-stratsketch`).

### Strats file layout (for developers)

v2 Stratmaker (React) lives under `src/features/strats/` with drawing in `map-kernel/`:

| Path | Role |
|------|------|
| `src/features/strats/browser/` | Strat catalog, folders, search |
| `src/features/strats/editor/` | Stratmaker page, tools panel, map chrome, canvas bridge |
| `map-kernel/` | Map viewer, scene graph, canvas renderer, interaction, selection handles |
| `map-kernel/icons/` | StratSketch icon pack, resolve helpers, HLL object catalog |
| `public/assets/hll-objects/` | HLL placeable SVGs (Maps Let Loose–compatible sizes; PNGs kept as vectorize sources) |
| `src/lib/collab/` | Yjs provider + kernel/whiteboard bridges |
| `functions/api/strats*.js` | Cloudflare Pages Functions handlers |
| `functions/lib/strats-store.js` | D1 persistence for strats |
| `functions/lib/strat-objects.js` | Server-side object sanitization / allowlists |

Legacy v1 strats paths under `js/strats/` / `js/ui/strats*.js` apply only to the older climbing-guide shell if still present.

## Micro Prep mode (whiteboard & slideshow)

**Micro Prep** is a freeform planning workspace for match prep notes, diagrams, and slide decks. It uses the same **map-kernel** drawing engine and Strat-grade tools (pen, lines with caps/bezier/arrowheads, shapes, text with outline/shadow, eraser) instead of the previous Excalidraw embed.

Open **Micro Prep** from the hub. Choose **Whiteboard** (square canvas) or **Slideshow** (16:9 letterboxed stage with a slide list).

### Scene format (v2)

Boards persist as `sceneVersion: 2` with kernel `objects[]` and an optional `pageUrl` (uploaded image or composed HLL map). **Existing boards saved in the old Excalidraw format open empty** — redraw or re-import content as needed.

| Mode | Scene shape |
|------|-------------|
| **Whiteboard** | `{ sceneVersion: 2, objects: [], appState: { theme }, pageUrl: null }` |
| **Slideshow** | `{ sceneVersion: 2, slides: [{ id, name, order, objects: [], appState: { theme }, pageUrl: null }] }` |

Theme (dark/light) is stored in `appState`. Page backgrounds (upload or HLL map) are stored per board or per slide as `pageUrl` (R2 URL), not as inline data URLs.

### Tools

| Tool | Notes |
|------|-------|
| **Select** | Move, resize, edit selection via sidebar |
| **Draw / Highlighter / Line / Shapes / Text / Eraser** | Same kernel tool model as Strats (highlighter = pen preset; sticky note = yellow filled rect preset) |
| **HLL Map** | Composes tactical map + optional grid/strongpoints overlays, uploads PNG to R2, sets kernel page |
| **Page background** | Upload image → kernel page (replaces blank square or 16:9 page asset) |

Strat-only tools (**Icons**, **HLL placeables**, **Ping**) are not included in Micro Prep.

### Slideshow

Each slide has its own `objects[]` and optional `pageUrl`. Switching slides flushes the active slide to storage and loads the next without remounting the canvas. The stage stays letterboxed 16:9 with panel-aware fit.

### Live collaboration

When collab is connected, object edits sync over Yjs `objects[]` (same bridge as Strat slides). Slide list / title / page metadata save via the API when offline from collab.

### Micro Prep file layout (for developers)

| Path | Role |
|------|------|
| `src/features/micro-prep/` | Editor, tools panel, canvas wrapper, slides helpers |
| `src/features/micro-prep/MicroPrepCanvasWrapper.jsx` | React bridge to map-kernel with custom page images |
| `src/features/micro-prep/MicroPrepToolsPanel.jsx` | Strat `ToolsPanelOptions` + micro-prep chrome |
| `src/features/micro-prep/microPrepPages.js` | Scene v2 defaults and normalization |
| `src/features/micro-prep/composeHllMapImage.js` | Bake HLL map + overlays for page insert |
| `public/assets/micro-prep/` | Blank square / 16:9 page SVG assets |
| `functions/api/whiteboards.js` | Create/list whiteboards (v2 default scene) |

Legacy Excalidraw files under `src/features/micro-prep/` (`ExcalidrawCanvas.jsx`, etc.) are unused and may be removed in a follow-up cleanup.

## Routeplanner mode (timed vehicle routes)

**Routeplanner** plans **faction vehicle routes** from HQ spawns to destinations on tactical maps. Routes respect the in-game **accessibility overlay** (no-drive zones from [Maps Let Loose](https://mattw.io/maps-let-loose/)), show **travel time in seconds**, and save as standalone plans in D1.

Open **Routeplanner** from the hub dashboard (shared tile with **Stratmaker**) or `/tool/routeplanner`. Shipped on v2 (`hll-tactika-test`) — see [agentx plan](docs/agentx/plans/routeplanner.md). Tracking: [#24](https://github.com/Djurre1981/hll-tactika-test/issues/24) (umbrella); sub-issues [#26–#30](https://github.com/Djurre1981/hll-tactika-test/issues?q=is%3Aissue+routeplanner) closed Jul 2026.

### Plan documents

| Field | Description |
|-------|-------------|
| **Title** | Display name for the plan |
| **Map** | Tactical map ID (same set as Strats) |
| **Faction** | Default US or GER for new routes (each route can override) |
| **HQ index** | Default start slot: **HQ north**, **HQ mid**, **HQ south** (indices 0–2) |
| **Routes** | Per route: name, optional **driver** (text; roster picker later), color, faction, HQ, vehicle, waypoints, polyline, travel time, match arrival |
| **Obstacles** | Vector polygons (traced accessibility + user edits) used for pathfinding |

Plans auto-save after edits. Create a new plan at `/tool/routeplanner`; the editor opens at `/routeplanner/{id}`. Routes replan only when you change a route (not on load or map switch).

### Route mapping

1. Pick **map** and **faction** in the left panel (when no route is selected). Choose default **start point** (**HQ north** / **HQ mid** / **HQ south**).
2. **Add route** → click the destination on the map.
3. Two-phase pathfinding: **grid A\*** on a 384×384 accessibility grid, then **string-pull** smoothing with truck-width clearance checks.
4. **Adjust the route:** drag waypoints, click the path to insert a waypoint, **Delete** to remove the selected waypoint.
5. Multiple routes per plan; each gets a color. The right **Routes** panel lists them — hover to highlight on the map.
6. **Per-route settings** (left panel when a route is selected):
   - **Name** and **Driver** (free text; match roster picker planned)
   - **Color** — presets + custom picker
   - **Faction** — US or GER (replans if path exists)
   - **Start point** — HQ north / mid / south (replans from new HQ)
   - **Vehicle** — HLL object icon row (transport, supply, jeep, halftrack); travel time uses that vehicle’s speed from `vehicles.json`
7. A rotated **HLL object icon** marks each route start on the map, aligned with the first segment.

**Clearance:** pathfinding validates the full vehicle body width (~2.17 m transport truck) via capsule sampling — not just the route centerline. Width comes from FModel `JeepBarrier` exports (`npm run extract:vehicles`).

### Match timing & timeline

Routes that cross the **frontier wall** (first 120s of the match) show:

- **Drive time** — raw seconds at constant top speed
- **Match arrival** — e.g. `2:06` including wait at the wall until 2:00

A dashed **frontier wall** line appears on the map at the **B/C border** (Allies) or **H/I border** (Axis) — two grid squares from HQ on the 10×10 tactical grid. The bottom **match timeline** scrubber animates all routes together; **Space** toggles play/pause. Wall drop is marked at 2:00 on the scrubber.

Timing is ETA-only — pathfinding does not block routes beyond the wall; the engine adds wait time when the route crosses early.

### Vehicle stats ([#26](https://github.com/Djurre1981/hll-tactika-test/issues/26))

Speeds come from FModel wheeled blueprint JSON (PhysX drivetrain theoretical max). Per-route **HLL icon picker** uses the same catalog as Stratmaker (`route-vehicles.js` → `vehicles.json`).

```bash
npm run extract:vehicles -- --input "C:/path/to/FModel/Exports/HLL/Content/Blueprints/Vehicles"
```

Output: `public/data/vehicles.json` (MaxRPM, gear ratios, wheel radius → `maxSpeedKmh`). No acceleration model — constant top speed along the polyline. Re-run when game exports change.

### Stratmaker embed ([#28](https://github.com/Djurre1981/hll-tactika-test/issues/28))

On an active strat slide, attach a **route plan** (filtered by slide map + match faction Allies→US / Axis→GER). Routes render read-only on the strat map; **Open in Routeplanner** and **Copy link** buttons appear in the slide panel.

### Obstacle editing

Toggle **Obstacles** in the bottom map chrome to dim the map and edit collision geometry (full left panel, Stratmaker glass UI):

| Tool | Use |
|------|-----|
| **Select** | Click a shape; drag body or anchor handles to reshape |
| **Pen add** | Draw polygons; merges with overlapping obstacles (boolean union) |
| **Pen subtract** | Draw cut shapes over obstacles |

On open, traced accessibility vectors load from `public/data/accessibility/{mapId}.vectors.json` (384² grid, zero padding, merged overlapping shapes on import).

### Routeplanner API

All routes require Steam auth. Create/update/delete require editor role.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/route-plans` | List route plans |
| `POST` | `/api/route-plans` | Create plan |
| `GET` | `/api/route-plans/{id}` | Load plan |
| `PUT` | `/api/route-plans/{id}` | Update plan |
| `DELETE` | `/api/route-plans/{id}` | Delete plan |

Migration: `migrations/0013_route_plans.sql` (`route_plans` table).

### Data & build scripts

| Asset / script | Role |
|----------------|------|
| `public/data/hq-spawns.json` | Faction HQ spawn points per map |
| `public/data/vehicles.json` | Wheeled vehicle speeds (FModel blueprint extract) |
| `public/maps/accessibility/{mapId}_Accessible.png` | Source accessibility overlays |
| `public/data/accessibility/{mapId}.vectors.json` | Traced obstacle polygons for pathfinding |
| `npm run extract:accessibility` | Regenerate 384² grid JSON + mono trace from PNGs |
| `npm run extract:accessibility:vectors` | Regenerate vector obstacle JSON only |
| `npm run merge:vector-obstacles` | Merge overlapping obstacle polygons (e.g. Carentan cleanup) |
| `npm run import:obstacle-svg` | Import hand-traced SVG obstacles (auto-merge on import) |
| `npm run extract:hq-spawns` | Regenerate HQ spawn data from Maps Let Loose |
| `npm run extract:vehicles` | Regenerate wheeled speeds + body width from FModel Vehicles JSON export |

### Routeplanner file layout (for developers)

| Path | Role |
|------|------|
| `src/features/routeplanner/` | Editor, routes panel, obstacle overlay, Stratmaker-matched glass UI |
| `src/features/routeplanner/path/` | Route engine (A* + string-pull), segment/vehicle clearance, accessibility grid |
| `src/features/routeplanner/obstacles/` | Vector load/merge, boolean pen ops, rasterization |
| `src/features/routeplanner/route-vehicles.js` | Faction vehicle catalog → HLL icons + speeds |
| `src/features/routeplanner/timing/` | Travel time, frontier wall, match-clock ETA, timeline keyframes |
| `src/features/strats/editor/StratRouteOverlay.jsx` | Read-only route overlay on strat slides |
| `src/features/strats/editor/SlideRoutePlanPicker.jsx` | Attach route plan to slide |
| `functions/api/route-plans*.js` | Cloudflare Pages Functions handlers |
| `functions/lib/route-plans-store.js` | D1 persistence |
| `scripts/trace-accessibility-vectors.mjs` | High-res vector tracing pipeline |
| `scripts/benchmark-route-path.mjs` | Local pathfinding benchmark (Carentan HQ → town) |
| `scripts/benchmark-match-timing.mjs` | Frontier wall wait + match arrival benchmark (Carentan US HQ north) |
| `docs/agentx/plans/routeplanner-pathfinding.md` | Pathfinding design (Google Maps / OSRM patterns) |
| `docs/agentx/plans/routeplanner.md` | Agentx plan + phased roadmap |

### Roadmap (deferred)

- Match **driver** field → roster player picker (linked to scheduled match)
- Per-vehicle body width in clearance (today: transport-truck width for all routes)
- Terrain surface speed modifiers (declined — not worth the data cost)
- In-game spot-check calibration for `vehicles.json` speeds
- Acceleration / torque-curve timing model
- Pathfinding blocked by frontier wall (today: ETA-only wait at wall crossing)

## Roadmap

- Fixing any bugs after release.
- Reviewing the requested changes for the current modules and implementing them.

After this any future module addition will depend on feedback of members and prep team needs.
There are a lot of ideas (Planning section for rostering etc.?, More Guides? Tanks section?..)

## Documentation

- [User & editor guide](docs/user-guide.md) — for members and pin contributors
- [Project overview](docs/project-overview.md)
- [Folder structure](docs/folder-structure.md)
- [Circle roles](docs/roles.md)
- [API reference](docs/api.md)
- [Data schemas & storage](docs/data-schemas.md)
- [Security: anti-exfiltration plan](docs/security-hybrid-plan.md) — deployed hybrid marker/detail split

## Quick start

### Staging (Cloudflare Pages) — this repo

Auth and protected pins require **Cloudflare Pages** with Functions (GitHub Pages alone cannot run the auth API).

| Site | Pages project | GitHub repo |
|------|---------------|-------------|
| **V1 production** (climbing guide) | `hll-tactika` | `HLL_interactive_climb` |
| **V2 staging** (this repo) | `hll-tactika-test` | `hll-tactika-test` |

`npm run deploy` **only** publishes to **`hll-tactika-test`**. Never deploy this repo to `hll-tactika` — that overwrites production V1.

1. Install dependencies: `npm install`
2. Copy `.dev.vars.example` to `.dev.vars` and set:
   - `SESSION_SECRET`: long random string
   - `PIN_DETAIL_SECRET`: separate long random string for per-pin detail tokens (required)
   - `OWNER_STEAM_IDS`: owners (full control)
   - `ADMIN_STEAM_IDS`: Comp Admins
   - `ASSIST_STEAM_IDS`: Comp Assist (optional)
   - `EDITOR_STEAM_IDS`: Comp Advisor (optional)
   - `VIEWER_STEAM_IDS`: Comp Member (optional; `USER_STEAM_IDS` is a legacy alias)
   - `STEAM_API_KEY` (optional): [Steam Web API key](https://steamcommunity.com/dev/apikey) for display names/avatars
   - `ALERT_DISCORD_WEBHOOK_URL` (optional): Discord webhook(s) for access anomaly alerts (comma-separated for multiple)
3. Local dev: `npm run dev` → [http://localhost:8788](http://localhost:8788)
4. Deploy: `npm run deploy` (or connect the GitHub repo in the Cloudflare Pages dashboard)

Set the same secrets in Cloudflare: **Pages → your project → Settings → Environment variables**.

Optional security tuning: `DETAIL_TOKEN_TTL_SEC`, `ALERT_*`, `AUDIT_ENABLED`, `AUDIT_MAX_EVENTS`. See [`docs/security-plan.md`](docs/security-plan.md).

### Finding a Steam ID64

After a member signs in once (even if not yet allowlisted), check server logs, or use a site like [steamid.io](https://steamid.io/). Profile URL `https://steamcommunity.com/profiles/76561198…` contains the ID64.

### Legacy static server (no auth)

`python -m http.server 8080` still serves maps/overlays but **will not load tricks** without the auth API.

Open [http://localhost:8080](http://localhost:8080) only for map asset testing.

## Adding pins

Edit `data/pins.json` to add built-in pins per map. Pins are **not** served publicly; markers load per map from `GET /api/pins?mapId=...` after Steam auth. Full pin details (video URLs, descriptions) require a per-pin token fetch.

Use **Add pin** in editor mode to create tricks. Seed pins in `data/pins.json` (with `createdBy: null`) are editable by Comp Assist, Comp Admin, and Owner.

```json
{
  "defaultMapId": "SMDMV2",
  "pins": {
    "SMDMV2": [
      {
        "id": "unique-id",
        "title": "Bush climb, orchard edge",
        "description": "Short explanation of the trick",
        "tag": "climb",
        "faction": "neutral",
        "x": 38.5,
        "y": 52.0,
        "videoUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
        "requires": {},
        "createdBy": null
      }
    ]
  }
}
```

Coordinates are percentages (0-100) so pins stay aligned when zooming. MG spots also need `dirX` and `dirY` for arrow direction. Optional `mediaItems` array supports multiple images and videos per pin.

## Maps & attribution

Tactical map images and spawn/strongpoint data are sourced from the community project [maps-let-loose](https://github.com/mattwright324/maps-let-loose) by mattwright324. Map assets are derived from Hell Let Loose (Team17).

| Map | ID |
|-----|-----|
| Carentan | `Carentan` |
| Driel | `Driel` |
| El Alamein | `ElAlamein` |
| Elsenborn | `Elsenborn` |
| Foy | `Foy` |
| Hill 400 | `Hill400` |
| Hurtgen | `HurtgenV2` |
| Juno Beach | `Juno` |
| Kharkov | `Kharkov` |
| Kursk | `Kursk` |
| Mortain | `Mortain` |
| Omaha Beach | `Omaha` |
| Purple Heart Lane | `PHL` |
| Remagen | `Remagen` |
| Saint Marie du Mont | `SMDMV2` |
| Sainte-Mère-Église | `SME` |
| Stalingrad | `Stalingrad` |
| Smolensk | `Smolensk` |
| Tobruk | `Tobruk` |
| Utah Beach | `Utah` |

Map images live in `maps/no-grid/`. Spawn data is in `data/map-spawns.json` (generated from maps-let-loose `data.js` via `scripts/extract-map-data.py`).

## Controls

| Action | Input |
|--------|-------|
| Pan | Click + drag |
| Zoom | Scroll wheel or +/- buttons |
| Reset view | **Reset view** button |
| Switch map | Sidebar map dropdown |
| Toggle overlays | Sidebar checkboxes |
| Add pin | **Add pin** → click map → fill form |

### Strats mode

| Action | Input |
|--------|-------|
| Open Strats | App navigation / Strats browser |
| Open Routeplanner | Hub → Routeplanner (or `/tool/routeplanner`) |
| Open Micro Prep | Hub → Micro Prep |
| Select / draw | Left sidebar tools |
| Finish draw → Select | **Right-click** on the map |
| Pan map | Drag (blocked while drawing or dragging a selection) |
| Map overlays | Bottom map chrome (grid, strongpoints, spawn radius, fit) |
| New / open / import | Editor side panel |
| Edit slides | Side panel slide list |
| Copy / paste shapes | **Ctrl+C** / **Ctrl+V** / **Ctrl+X** |
| Undo / redo | **Ctrl+Z** / **Ctrl+Y** |
