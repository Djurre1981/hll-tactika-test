# Plan: Routeplanner (#24)

## Goal
Build a standalone truck route planner that uses game-accurate constraints and vehicle speed to plot transport-truck routes from HQ spawn to destination, with accessibility-aware pathfinding and per-route **travel time** (duration in seconds).

## Agreed decisions (from lead gate)
- **Tool shape:** Standalone tool at `/tool/routeplanner` — own page, own saved route plans (not a Stratmaker mode for MVP)
- UI / framework: React + existing `map-kernel` canvas (same stack as Stratmaker)
- Base layer: Stratmaker-style map view (map + faction context)
- **Vehicle (MVP):** Transport truck only
- **Speed (placeholder):** 38 km/h until AES/game-data extraction is wired — user will provide keys/scripts later
- **Accessibility data:** Extract from [maps-let-loose](https://github.com/mattwright324/maps-let-loose) pipeline (same source as existing `extract-map-data.py`)
- **Pathfinding style:** Shallow curves as primary goal — route like a vehicle at top speed would take around obstacles; fixed padding on blocked polygons as secondary constraint
- **MVP scope:** Route mapping + accessibility snapping + **travel time** (route duration in seconds) — no match-clock ETA, no animation scrubber in v1
- Blind-spot defaults: auth same as strats (logged-in save); no public anonymous plans unless user says otherwise
- Explicitly skipped for v1: match arrival time (“arrives at 2:34”), timeline animation scrubber, enemy route prediction, rocket prefire, RCON, strat slide embed, AES extraction (deferred)

## Game rules (recorded for later phases)
- **Frontier wall:** For the first **120 seconds** after game start, a virtual boundary blocks vehicle access beyond the first **2 grid columns or rows** on the HQ side of the map. It disappears at exactly t=120s — hard fact, no exceptions. Trucks **can** drive anywhere within those first 2 columns/rows (up to the wall) during the 120s window.
- **Wall geometry:** A straight line from map top to bottom (or left to right for top/bottom HQ layouts), positioned on the grid border after the 2nd accessible column/row — **not** a rectangle around HQ, but a full-map-spanning line on that grid edge.
- **Faction + map dependent:** Wall axis and position follow which side of the map the faction’s HQs are on.
- **Example — Carentan, US (HQs on left):** Wall runs **top to bottom** on the border between **column B and column C**. Columns A and B are drivable until t=120s; column C onward is blocked until the wall drops.
- Grid squares are 200×200 m; map coordinate system matches existing `map-kernel` (−20…120 map-%).
- Routes always start at one of three faction HQs (vehicle spawn points).
- Sharp 90° turns are invalid; pathfinder favors shallow/racing-line curves.

## Isolation lane
**local** — single large feature on branch `agentx/routeplanner`; consider worktrees only if parallel extraction + UI agents are requested later.

## Assumptions
- Accessibility overlay = in-game colored no-drive zones from Maps Let Loose (not web a11y).
- Placeholder speed 38 km/h ≈ 10.56 m/s → ~18.9 s per 200 m grid edge at constant speed (sanity-check only; timing engine uses meters + m/s).
- HQ spawn points derivable from existing `map-spawns.json` / MLL `data.js` (same as strat spawns).
- Real vehicle stats replace placeholder when user provides AES keys/scripts.

## Phases

### Phase 0 — Data foundation
| ID | Task | Writes (ownership) | Depends on | Verify |
|----|------|--------------------|------------|--------|
| T0a | Transport truck constants (placeholder 38 km/h) | `public/data/vehicles.json` | — | Used by timing engine |
| T0b | Extract accessibility overlay polygons per map from MLL repo | `scripts/extract-accessibility.*`, `public/data/accessibility/{mapId}.json` | MLL clone in `_maps_source` or `tmp-maps-let-loose/` | Overlay renders on one test map |
| T0c | HQ spawn points + faction context for transport truck | extend `public/data/map-spawns.json` or `public/data/hq-spawns.json` | existing MLL extract | 3 HQs per map/faction selectable |

### Phase 1 — Route mapping UI
| ID | Task | Writes (ownership) | Depends on | Verify |
|----|------|--------------------|------------|--------|
| T1a | Routeplanner entry + map/faction/HQ picker (transport truck fixed) | `src/features/routeplanner/` | T0c | Can start a route from HQ |
| T1b | Route line object type + anchor editing in map-kernel | `map-kernel/` (route object, handles) | — | User can add/move anchors |
| T1c | Accessibility collision + shallow-curve detour pathfinding | `src/features/routeplanner/path/` (or `map-kernel/route-pathfinder.js`) | T0b, T1b | Line reroutes around blocked zones with shallow arcs, not 90° kinks |
| T1d | Multi-route sidebar (colors, hover highlight) | `src/features/routeplanner/RoutesPanel.jsx` | T1b | Hover highlights route on map |

**Pathfinder design note:** For each obstacle, ask “how would a transport truck at 38 km/h arc around this?” — fixed polygon padding defines no-go margin; the path between clearance points should be smooth/shallow, not orthogonal zig-zags.

### Phase 2 — Travel time (MVP)
| ID | Task | Writes (ownership) | Depends on | Verify |
|----|------|--------------------|------------|--------|
| T2a | Travel-time engine: path length ÷ speed (+ optional turn slowdown) | `src/features/routeplanner/timing/` | T0a, T1c | Displayed seconds match manual calc on flat test route |

### Phase 2b — Match clock & animation (post-MVP)
| ID | Task | Writes (ownership) | Depends on | Verify |
|----|------|--------------------|------------|--------|
| T2b | Frontier wall model (2 col/row from HQ side, opens at t=120s) + match arrival ETA | `src/features/routeplanner/timing/match-clock.js`, `public/data/frontier-walls.json` | T2a | Carentan US: route blocked at B/C border before 120s; opens after |
| T2c | Timeline scrubber + animated vehicle pin(s) | `src/features/routeplanner/TimelineScrubber.jsx`, map-kernel draw | T2a, T2b | Pin moves along route vs match time |

### Phase 2c — Real game data (when user provides keys)
| ID | Task | Writes (ownership) | Depends on | Verify |
|----|------|--------------------|------------|--------|
| T2d | AES extraction: replace placeholder speed/accel with game values | `scripts/extract-vehicle-data.*`, `vehicles.json` | user keys/scripts | In-game spot-check on one route |

### Phase 3 — Persistence
| ID | Task | Writes (ownership) | Depends on | Verify |
|----|------|--------------------|------------|--------|
| T3a | Save/load route plans (API + schema) | `migrations/`, `functions/api/routes/` | T1–T2 | Reload restores routes + travel times |

## Integration order
1. T0 (MLL accessibility extract + placeholder vehicle + HQ data)
2. T1b can start in parallel with T0 once route object schema is agreed
3. T1 (mapping UI + pathfinding)
4. T2a (travel time display)
5. T3 (persistence)
6. T2b–T2d (frontier wall, animation, real AES data) — post-MVP

## Done when (MVP)
- [ ] User selects map, faction, HQ → destination on map (transport truck implicit)
- [ ] Route auto-avoids accessibility-blocked areas with editable anchors and shallow curves
- [ ] Multiple colored routes per plan; sidebar hover highlight
- [ ] Per-route **travel time in seconds** shown (38 km/h placeholder)
- [ ] Plan saves and reloads via `/tool/routeplanner`
- [ ] `npx vite build` passes; manual test on ≥1 map

## Risks
- **Accessibility extraction from MLL** — need to locate the right asset/layer in maps-let-loose; may require spike on one map (Carentan) first
- **Pathfinding quality** — shallow-curve constraint + fixed padding is non-trivial geometry; race-line quality will need iteration
- **Frontier wall (later)** — position is per map + faction (HQ side); e.g. Carentan US = vertical line at column B/C border. Route segments need timestamps so T2b can split “reachable in 120s” vs “after wall drops”
- **Placeholder vs real speed** — 38 km/h is good enough for MVP UX; swap must not break saved plans
- **Stratmaker coupling** — shared map-kernel edits need clear ownership to avoid colliding with strat editor work
