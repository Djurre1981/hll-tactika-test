# Routeplanner

**Goal:** plan timed vehicle routes with pathfinding and scrub the match timeline.

## Open Routeplanner

Hub → **Routeplanner** → open or create a plan (`/routeplanner/{id}`).

## Build a route

1. Set plan title; optionally **link a calendar event**.
2. Select a route (or add one). Name, driver, color, faction, HQ slot, and vehicle live on the route.
3. Pathfinding runs **HQ → destination** (grid A* + string-pull, truck-width clearance).
4. Add **waypoints** by clicking the map; drag to move; right-click or Delete to remove.

> Start point controls appear when a **route is selected**, not at the bare plan level.

## Timing

- **Frontier wall** (first ~120s) and arrival ETA are shown on the map / timeline.
- Use the **timeline scrubber** and playback to compare multiple routes.

![Routeplanner timeline](placeholder)

*Routeplanner: paths on the map plus timeline scrub for ETAs.*

## Obstacle mode

Toggle obstacle editing when you need to adjust accessibility vectors:

- Routes dim; route editing is blocked while in obstacle mode
- Toolbar shows a muted-red indicator so you know you’re not drawing paths

## Strat integration

Attach a route plan to a Stratmaker slide (filtered by map + faction) for a read-only overlay.

## Related

- [Stratmaker](Stratmaker)
- [Calendar & Match Brief](Calendar-and-Match-Brief)
- [Troubleshooting](Troubleshooting)
