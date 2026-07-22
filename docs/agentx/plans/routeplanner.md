# Plan: Routeplanner (#24)

**Status:** MVP shipped — [PR #25](https://github.com/Djurre1981/hll-tactika-test/pull/25) merged, deployed to `hll-tactika-test`.

## Goal
Build a standalone truck route planner that uses game-accurate constraints and vehicle speed to plot transport-truck routes from HQ spawn to destination, with accessibility-aware pathfinding and per-route **travel time** (duration in seconds).

## Agreed decisions (from lead gate)
- **Tool shape:** Standalone tool at `/tool/routeplanner` — own page, own saved route plans (not a Stratmaker mode for MVP)
- UI / framework: React + existing `map-kernel` canvas (same stack as Stratmaker)
- Base layer: Stratmaker-style map view (map + faction context)
- **Vehicle (MVP):** Transport truck only
- **Speed (placeholder):** 38 km/h until AES/game-data extraction is wired — see [#26](https://github.com/Djurre1981/hll-tactika-test/issues/26)
- **Accessibility data:** Extract from [maps-let-loose](https://github.com/mattwright324/maps-let-loose) pipeline; high-res vector trace at 1920²
- **Pathfinding style:** A* on rasterized obstacles; waypoint editing; shallow curve smoothing on output polyline
- **MVP scope:** Route mapping + accessibility snapping + **travel time** + obstacle edit mode + D1 persistence
- Blind-spot defaults: auth same as strats (logged-in save); no public anonymous plans unless user says otherwise
- Explicitly deferred: match-clock ETA ([#29](https://github.com/Djurre1981/hll-tactika-test/issues/29)), timeline animation ([#30](https://github.com/Djurre1981/hll-tactika-test/issues/30)), multi-vehicle ([#27](https://github.com/Djurre1981/hll-tactika-test/issues/27)), strat embed ([#28](https://github.com/Djurre1981/hll-tactika-test/issues/28)), AES extraction ([#26](https://github.com/Djurre1981/hll-tactika-test/issues/26))

## Game rules (recorded for later phases)
- **Frontier wall:** For the first **120 seconds** after game start, a virtual boundary blocks vehicle access beyond the first **2 grid columns or rows** on the HQ side of the map. It disappears at exactly t=120s — hard fact, no exceptions. Trucks **can** drive anywhere within those first 2 columns/rows (up to the wall) during the 120s window.
- **Wall geometry:** A straight line from map top to bottom (or left to right for top/bottom HQ layouts), positioned on the grid border after the 2nd accessible column/row — **not** a rectangle around HQ, but a full-map-spanning line on that grid edge.
- **Faction + map dependent:** Wall axis and position follow which side of the map the faction’s HQs are on.
- **Example — Carentan, US (HQs on left):** Wall runs **top to bottom** on the border between **column B and column C**. Columns A and B are drivable until t=120s; column C onward is blocked until the wall drops.
- Grid squares are 200×200 m; map coordinate system matches existing `map-kernel` (0–100 map-%).
- Routes always start at one of three faction HQs (vehicle spawn points).
- Sharp 90° turns are invalid; pathfinder favors shallow/racing-line curves.

## Shipped (MVP — complete)

| Area | Delivered |
|------|-----------|
| T0a | `public/data/vehicles.json` — transport truck @ 38 km/h |
| T0b | `scripts/extract-accessibility.mjs`, `scripts/trace-accessibility-vectors.mjs`, PNGs + `.vectors.json` per map |
| T0c | `public/data/hq-spawns.json` — 3 HQs per map/faction |
| T1 | Routeplanner editor UI, map/faction/HQ, waypoint routes, Routes panel |
| T1c | A* pathfinding + obstacle rasterization (384 grid) |
| T2a | `travel-time.js` — seconds from polyline length |
| T3 | `migrations/0013_route_plans.sql`, `/api/route-plans` CRUD |
| Extra | Obstacle edit mode, pen tool (Illustrator-style anchors), dashboard tile with Stratmaker |

## Phases (remaining)

### Phase 2 — Match timing & preview
| Issue | Task |
|-------|------|
| [#29](https://github.com/Djurre1981/hll-tactika-test/issues/29) | Frontier wall model + match-clock ETA |
| [#30](https://github.com/Djurre1981/hll-tactika-test/issues/30) | Timeline scrubber + animated vehicle pin(s) |

### Phase 3 — Accuracy & breadth
| Issue | Task |
|-------|------|
| [#26](https://github.com/Djurre1981/hll-tactika-test/issues/26) | AES extraction → real speed/accel in `vehicles.json` |
| [#27](https://github.com/Djurre1981/hll-tactika-test/issues/27) | Multi-vehicle types per plan |

### Phase 4 — Integration
| Issue | Task |
|-------|------|
| [#28](https://github.com/Djurre1981/hll-tactika-test/issues/28) | Embed / link route plans in Stratmaker slides |

## MVP acceptance (done)

- [x] User selects map, faction, HQ → destination on map (transport truck implicit)
- [x] Route auto-avoids accessibility-blocked areas with editable waypoints
- [x] Multiple colored routes per plan; sidebar hover highlight
- [x] Per-route **travel time in seconds** shown (38 km/h placeholder)
- [x] Plan saves and reloads via `/tool/routeplanner`
- [x] Obstacle edit mode with traced vectors + pen tool
- [x] Dashboard entry alongside Stratmaker
- [x] `npx vite build` passes; deployed to staging

## Risks
- **Pathfinding quality** — shallow-curve / race-line quality may need iteration beyond grid A*
- **Frontier wall (later)** — position is per map + faction; route segments need timestamps for [#29](https://github.com/Djurre1981/hll-tactika-test/issues/29)
- **Placeholder vs real speed** — 38 km/h is good enough for MVP UX; swap must not break saved plans ([#26](https://github.com/Djurre1981/hll-tactika-test/issues/26))
- **Large static assets** — accessibility PNGs + vector JSON committed per map; regen via `npm run extract:accessibility`
