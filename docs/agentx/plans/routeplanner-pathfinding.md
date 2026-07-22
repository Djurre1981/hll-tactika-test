# Plan: Routeplanner pathfinding rework

**Status:** Implemented — replaces grid A* + fragile post-hoc LOS shortcutting.

## Problem

The MVP pipeline was **grid A\*** (8-connected, 384² raster) followed by **greedy line-of-sight simplification** on the grid polyline. That pattern is *not* what production map/chart planners use, and it fails in practice:

| Issue | Symptom |
|-------|---------|
| Grid-only search | Routes follow cell corridors; miss shorter any-angle cuts past obstacle corners |
| Post-hoc shortcutting | LOS runs only between vertices already on the grid path — not globally shortest |
| Two-stage validation | Simplified path could fail clearance check → fallback to full 344-cell zigzag |
| Endpoint injection | User click coords injected before simplify → invalid final segments |

## Industry reference (Google Maps, Strava, OSRM, Valhalla)

| Product | Obstacle / network model | Search | Post-process | Waypoints |
|---------|-------------------------|--------|--------------|-----------|
| **Google Maps** | Road graph (OSM/TIGER) | A* / CH / ALT on sparse graph | Map matching, turn costs | Ordered via-points; independent leg per segment |
| **Strava** | Trail/road graph from OSM | Graph shortest path | Snap-to-trail | Manual points constrain legs |
| **OSRM / Valhalla** | Routing graph + access tags | Contraction hierarchies / A* | Geometry refinement | Via nodes in URL API |
| **Game / off-road** (no road graph) | Navmesh or clearance field | **Lazy Theta\***, visibility graph | **String pulling** / funnel | Same leg model as Maps |

**Tactika has no road graph** — only a clearance field (accessibility raster + vector obstacles). The correct analog is **off-road / navmesh routing**, not “grid walk + hope shortcuts work”.

### Mapping Tactika concepts → Maps/Strava model

| Maps/Strava | Tactika |
|-------------|---------|
| Road network node | Free-space sample / grid cell |
| Blocked road | Blocked raster cell or vector polygon |
| “Snap to road” | Snap HQ/clicks to nearest free cell |
| Route leg (A→B) | One pathfind between consecutive waypoints |
| Via-point | User waypoint (`user: true`) |
| Hidden routing points | Auto path geometry only — not shown as handles |

## Chosen architecture

```
waypoints[]  →  for each leg (A, B):
                    1. snap A, B to free cells
                    2. Grid A* on clearance field        ← OSRM-style route search
                    3. string-pull polyline              ← geometry refinement (SSFA family)
                    4. apply exact endpoints if clear
                 → concat legs (Maps/OSRM leg model)
```

### Why two-phase search + geometry (OSRM / Valhalla pattern)

Production routers **never** rely on “walk a grid then hope shortcuts work”. They split:

| Phase | OSRM / Valhalla | Tactika |
|-------|-----------------|---------|
| **Search** | Shortest path on routing graph | A* on 384² clearance grid |
| **Geometry** | Turn-by-turn polyline, map matching | String-pull with sub-cell clearance |

This matches Google Maps / Strava at the architectural level: **sparse search, then geometry simplification** — even though our “graph” is a clearance field rather than OSM roads.

### Why string pulling (not Chaikin smoothing)

- **String pulling / SSFA** keeps the path in free space — smoothing splines do not (they cut through buildings).
- Same role as geometry post-processing in OSRM after graph routing.

### Lazy Theta* (optional future)

`lazy-theta-star.js` implements any-angle search during the search phase (game/robotics standard when no road graph exists). Benchmark showed marginal length gain (~0.7 map-%) at higher CPU on 384² grids; kept for future tuning, not hot path.

### Clearance model (single source of truth)

- Accessibility raster at **384²** native (`extract-accessibility.mjs`, `paddingCells: 0`).
- Vector trace padding **0 px** (`trace-accessibility-vectors.mjs`).
- **Vehicle width** from FModel `JeepBarrier` `BoxExtent.Y` on Ford transport (~108.5 cm half-width → **~2.17 m** total).
- Obstacles dilated by `ceil(bodyHalfWidth / cellSize)` grid cells before A* (Minkowski sum — centerline path = truck body clearance).

## Files

| File | Role |
|------|------|
| `path/segment-clearance.js` | Shared obstacle segment / path checks |
| `path/lazy-theta-star.js` | Optional any-angle search (future) |
| `path/string-pull.js` | Post-search polyline simplification |
| `path/route-engine.js` | Leg orchestration (A* → string-pull → endpoints) |
| `path/plan-route.js` | Public API — waypoint legs unchanged |
| `path/astar.js` | `snapToNearestFree` + legacy grid A* fallback |

## Acceptance

- [x] Leg-based routing preserved (Google Maps via-point model)
- [x] Paths never cross blocked cells (clearance validated)
- [x] Shorter polylines than grid-A* + fallback on Carentan HQ1 → town benchmark
- [x] Replan only on user route edits (no auto-replan on load)

## Deferred

- Road preference / racing-line curvature ([#24 game rules](routeplanner.md))
- Frontier wall time-varying clearance ([#29](https://github.com/Djurre1981/hll-tactika-test/issues/29))
- Full visibility graph from vector vertices (if Theta* quality insufficient at higher obstacle counts)
