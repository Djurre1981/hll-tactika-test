# Plan: Routeplanner (#24)

**Status:** Phases 2–4 implemented on branch `routeplanner` (not merged). MVP shipped — [PR #25](https://github.com/Djurre1981/hll-tactika-test/pull/25).

## Goal
Build a standalone truck route planner that uses game-accurate constraints and vehicle speed to plot transport-truck routes from HQ spawn to destination, with accessibility-aware pathfinding and per-route **travel time** (duration in seconds).

## Agreed decisions (from lead gate)
- **Tool shape:** Standalone tool at `/tool/routeplanner` — own page, own saved route plans (not a Stratmaker mode for MVP)
- UI / framework: React + existing `map-kernel` canvas (same stack as Stratmaker)
- Base layer: Stratmaker-style map view (map + faction context)
- **Vehicle:** Per-route picker — transport, supply, jeep, halftrack per faction ([#27](https://github.com/Djurre1981/hll-tactika-test/issues/27))
- **Speed:** FModel wheeled blueprint drivetrain extract via `npm run extract:vehicles` ([#26](https://github.com/Djurre1981/hll-tactika-test/issues/26)); theoretical top speed only (no acceleration)
- **Match timing:** Frontier wall wait in ETA only — pathfinding unchanged ([#29](https://github.com/Djurre1981/hll-tactika-test/issues/29))
- **Strat embed:** Read-only overlay + deep link; strict map + match faction ([#28](https://github.com/Djurre1981/hll-tactika-test/issues/28))
- **Accessibility data:** Extract from [maps-let-loose](https://github.com/mattwright324/maps-let-loose) pipeline; 384² grid + vector trace
- **Pathfinding style:** Two-phase routing (A* + string-pull). See [routeplanner-pathfinding.md](./routeplanner-pathfinding.md).

## Game rules (frontier wall)
- **Frontier wall:** First **120 seconds** — vehicles cannot pass beyond 2 grid columns from HQ side. Wall drops at t=120s.
- **Wall geometry:** Vertical line at map-% **40** (left HQ) or **60** (right HQ); full map height.
- **Example — Carentan US:** Wall at column B/C border; cols A–B open until 2:00.
- Grid squares are 200×200 m; coordinates 0–100 map-%.

## Shipped

| Phase | Issue | Delivered |
|-------|-------|-----------|
| MVP | #24 | Editor, pathfinding, obstacles, D1 plans, dashboard entry |
| 2 | #29 | `frontier-wall.js`, `route-timing.js`, match-clock ETA in Routes panel, wall overlay |
| 2 | #30 | `MatchTimeline.jsx`, `RoutePlaybackOverlay.jsx`, multi-route scrubber |
| 3 | #26 | `extract:vehicles` documented; `vehicles.json` theoretical max speeds |
| 3 | #27 | `route-vehicles.js`, per-route vehicle + icon at start |
| 4 | #28 | `slide.routePlanId`, `SlideRoutePlanPicker`, `StratRouteOverlay` |

## Key files

| Path | Role |
|------|------|
| `timing/frontier-wall.js` | Wall line geometry, hqSide lookup |
| `timing/route-timing.js` | Match arrival, timeline keyframes, `formatMatchTime` |
| `FrontierWallOverlay.jsx` | Dashed wall line on map |
| `MatchTimeline.jsx` | Scrubber + play/pause (Space) |
| `RoutePlaybackOverlay.jsx` | Animated vehicle icons at scrub time |
| `strat-route-link.js` | Strat faction ↔ route faction mapping |
| `scripts/benchmark-match-timing.mjs` | Carentan US wall wait assertion |

## Verify

```bash
npm run build
node scripts/benchmark-route-path.mjs
node scripts/benchmark-match-timing.mjs
```

## Deferred

- Per-vehicle clearance width in pathfinding
- Terrain surface speed modifiers
- In-game speed spot-check / acceleration model
- Pathfinding blocked by frontier wall (ETA-only by design)

## Risks (resolved / open)

- **Wall crossing edge cases** — first outward crossing only; documented in `route-timing.js`
- **Strat list API** — `listRoutePlans` now includes `mapId`/`factionId` summary for picker filtering
