# Tactika — Current & Planned Features

**Tactika** is a private, team-internal strategy and planning platform for Hell Let Loose (The Circle competitive team). It runs on **Cloudflare Pages + D1 + R2**, with **Steam sign-in** and role-based access. V2 staging lives at `hll-tactika-test`; production V1 is still the climbing guide.

---

## Platform (shared across modules)

| Area | Shipped |
|------|---------|
| **Auth** | Steam login, allowlist, roles (Comp Member → Owner) |
| **Security** | Protected pin data, hybrid marker/detail split, audit hooks |
| **Hub** | Dashboard with upcoming events, **team KPI strip** (win rate, record, form), **My matches** + **My tasks** widgets, tool launcher, online presence |
| **Calendar** | Month view, event CRUD (scrim / comp / practice / other), match metadata (opponent, map, faction, **team** Circle / Circle Jr, result), **HeLO/CRCON links**, **event locking** |
| **Match Brief** | `/events/:id` — match details (incl. team), linked tools, prep task checklist, RSVP / raincheck, **You played** when your Steam ID is on our side |
| **Event hub** | `components` on events: stratIds, routePlanIds, whiteboardIds, rosterId; attach/detach on Brief |
| **Prep tasks** | Per-event assignments; assignees complete on Brief; Hub “My tasks” sidebar |
| **Team / roster** | Site access roster, shared Comp Roster (Circle + Circle Jr pool), drag-and-drop, multiple named rosters |
| **Management** | Staff section: Overview, Roster, Folders, **History** (Match + **Strat history** tabs), **Analytics** (win/loss charts) |
| **Media** | R2 uploads for videos/images; external links (YouTube, Medal, etc.) |
| **Collab** | Yjs live editing on Strat slides & Micro Prep; peer presence |
| **Maps** | All 20 HLL tactical maps, pan/zoom, grid & strongpoint overlays (Maps Let Loose data) |

---

## Match Brief & intertool (shipped Jul 2026)

Closed-release work ([#33](https://github.com/Djurre1981/hll-tactika-test/issues/33)) wires Calendar events into a single **Match Brief** command screen.

| Step | Feature | Status |
|------|---------|--------|
| T1 | Event **components hub** (strat / route / whiteboard / roster IDs) | ✅ |
| T2 | **Match metadata** on calendar events | ✅ |
| T3 | **Match Brief** page (`/events/:id`) | ✅ |
| T5 | **Attach/detach** linked tools on Brief | ✅ |
| T9 | **Prep tasks** — assign, complete, Hub my-tasks | ✅ |
| T8 | **Match history** — HLL Records + Management History | ✅ |
| — | **HeLO import** — Circle + **Circle Jr** (`◯`) series history → calendar + `participantSteamIds` + combat stats | ✅ |
| — | **Comp teams** — `match.team` `sr`/`jr`; create-event team selector; Records team filter | ✅ |
| — | **My matches / You played** — filter by logged-in Steam ID | ✅ |
| — | **Player combat stats** — `player_match_stats` from HeLO; Management player form / K/D | ✅ |
| — | **Strat history** — Management History tab: search/sort by date, opponent, map, faction, strongpoint | ✅ |
| — | **Event lock** — auto/manual lock; propagates to linked tools | ✅ |
| — | **Tool lock** — lock strats, routes, slideshows in-editor | ✅ |
| T10 | **Team KPIs** — Hub strip + Management Analytics charts | ✅ |
| T6/T7 | **RSVP + Hub next-match hero** — I’m in / Raincheck (web) | ✅ |
| T6b | **Raincheck flow** — match + reason; modal portals above hub chrome | ✅ |

### Match Brief UX

- Open from Calendar or Hub upcoming games
- Match facts (incl. **Circle / Circle Jr**), notes, linked-tool chips + deep links
- Editors attach/detach existing strats, route plans, whiteboards, rosters
- Tool editors (Stratmaker, Routeplanner, Micro Prep) can link events from their side panels
- **Prep tasks:** editors assign; assignees checkbox-complete; **Home → My tasks** for open items
- **Locking:** events auto-lock when past or win/loss recorded; per-tool lock in Stratmaker / Routeplanner / Micro Prep
- **Analytics:** Home **Season at a glance** KPIs; **Management → Analytics** (`/management#analytics`) — monthly W/L, win rate by map/opponent (Recharts)
- **History import:** Circle + Circle Jr matches from [HeLO](https://helo-system.de/) on v2 calendar; optional CRCON game links; see [`helo-import.md`](./helo-import.md)
- **My matches:** Hub widget + Records filter + Brief **You played** (Steam64 ↔ HeLO our-side `player_stats`). Spreadsheet rosters are reference-only — **do not** auto-grant site access from them
- **Strat history:** Management → History → Strat history tab (search + structured filters/sort)
- **Hub next match:** countdown, seats, I’m in / Raincheck

### Still planned (RallyPoint / #23)

| Step | Feature | Blocked by |
|------|---------|------------|
| T6/T7 Discord | Apollobot cutover / member sync for RSVP | T0c |
| T6b Discord | Waitlist fill pings | T0e |
| T4 | Create-match wizard | T0e (Discord notifications) |
| T0a–T0e | Discord bot, role map, roster sync, notifications | — |
| T12 | Discord posts, reminders, slash commands | T0 + T2 |

---

## Module 1: Interactive Climbing Guide (V1 + embedded)

The original module — still available via hub → **Climbing Guide** (`/climbing-guide-v1/`).

- **Climb** and **MG spot** pins on all maps
- Faction tags, filters, hover preview, full video playback
- Multi-media pins, editor mode (place, drag, undo/redo)
- Cloudflare-hosted trick videos + preview images
- Admin panel for members

---

## Module 2: Stratmaker (Strats)

Map-based tactical planning with multi-slide “decks.”

### Documents & browser

- Strat catalog with folders, search, drag-and-drop organization
- Metadata: title, team (jr/sr), type (friendly/tournament), notes, match info
- Slides: per-map drawings, reorder, duplicate, thumbnails
- StratSketch import, **per-tool lock** (creator/admin/owner; view-only when locked)
- D1 persistence, debounced autosave

### Drawing tools

- Select, pen, line, curved line (Bézier), rectangle, circle, text
- StratSketch-style icons (~75), HLL placeables (garrisons, vehicles, classes, etc.)
- Ping animation, eraser, color picker, stroke/fill options
- Shift/Alt modifiers (snap angles, proportional resize, draw from center)
- Copy/cut/paste, duplicate, undo/redo, keyboard nudge

### HLL-specific

- Spawn radius toggle, garrison radius check (valid/invalid preview)
- Route plan embed on slides (read-only overlay + deep link) — issue #28

### Collab

- Live Yjs sync per slide when multiple editors are present

---

## Module 3: Micro Prep

Freeform whiteboard & slideshow for match prep (map-kernel v2, replaces Excalidraw).

- **Whiteboard** (square canvas) and **Slideshow** (16:9, multi-slide)
- Same core draw tools as Strats (no icons/HLL placeables/ping)
- HLL map background composer (map + optional overlays → R2 page)
- Image page backgrounds, theme (dark/light)
- D1 whiteboards CRUD, Yjs collab on objects

---

## Module 4: Routeplanner (shipped on V2, Jul 2026)

Timed vehicle routes with accessibility-aware pathfinding — issue #24 umbrella, phases 2–4 merged.

### Route planning

- Standalone plans in D1 (`/tool/routeplanner` → `/routeplanner/{id}`)
- HQ → destination pathfinding: grid A* + string-pull, truck-width clearance
- Multiple routes per plan; per-route name, driver, color, faction, HQ slot, vehicle
- User waypoints: click to add, drag to move, right-click/Delete to remove
- Vehicle speeds from FModel extract (`vehicles.json`) — issue #26
- Per-route vehicle picker with HLL icons — issue #27

### Match timing — issue #29

- Frontier wall (first 120s), match arrival ETA, dashed wall on map
- Timeline scrubber + multi-route playback animation — issue #30

### Obstacles

- Traced accessibility vectors per map; pen add/subtract editing
- Obstacle mode dims routes, blocks route editing, muted-red toolbar indicator

### UI (recent, deployed)

- Editable plan title + **calendar event linking** (pick existing or create event)
- Start point only when a route is selected (not at plan level)
- Stable map camera when toggling obstacle mode

### Strat integration — issue #28

- Attach route plan to strat slide; filtered by map + faction

---

## Infrastructure completed (migration roadmap)

Phases **0–8** are done (D1, React shell, auth, dashboard, calendar, Strat browser, Strat editor, Micro Prep, Yjs collab).

**Phase 9 — Discord bot** is planned but not shipped: `/link`, event create, signups, reminders, embed sync, Hetzner deploy.

---

## Planned & deferred features

### Routeplanner (documented deferred)

- Driver field → **roster player picker** (linked to scheduled match)
- Per-vehicle body width in clearance (today: transport-truck width for all)
- Terrain speed modifiers, acceleration model, in-game speed calibration
- Block pathfinding at frontier wall (today: ETA-only wait)

### GitHub issues — open enhancements

| Issue | Topic |
|-------|--------|
| #23 | **RallyPoint-style features** — match wizard, RSVP, Discord push *(Match Brief, history, KPIs, HeLO import ✅; see #33)* |
| #12 | **Tool integrations** — HLLRecords profile links, live RCON, signups, notifications, inbox *(HeLO history + combat stats + RSVP/raincheck web ✅; CRCON enrichment / live RCON / Discord still open)* |
| #13 | **Engagement** — pin ratings, contribution XP/tiers |
| #5 | Link **roster matches ↔ strats** *(Strat history browse shipped; deep roster↔strat link still open)* |
| #11 | Link **roster matches ↔ Micro Prep** |
| #3 | Insert **image** into Strat builder |
| #8 | **Visibility layer** (Maps Let Loose–style fog) |
| #4 | Merge **line + arrow** tool |
| #2 | **Rich text** in Strat text tool |
| #7 | Review **icons for animation** |
| #9 | **HLL map images** in Micro Prep |
| #10 | Unify **whiteboard + slideshow** modes |
| #15 | **Bug:** recon role missing from comp roster role picker |

### README / product roadmap (high level)

- Bug fixes and member-requested polish on shipped modules
- Future modules driven by prep team feedback (e.g. tank guides, broader **Planning/rostering**)
- Cross-linking calendar ↔ strats ↔ route plans ↔ rosters (event hub + Brief attach shipped; roster-match deep links still open)

### Suggested near-term slice (from enhancement-issues-ranked.md)

1. README sync
2. Merge line/arrow tool
3. Icon animation audit
4. Match ↔ strat linking (unlocks Micro Prep linking)

---

## Deployment status

| Environment | Contents |
|-------------|----------|
| **V1 (`hll-tactika`)** | Climbing guide (production) |
| **V2 (`hll-tactika-test`)** | Full React hub + Strats + Micro Prep + **Routeplanner** + Match Brief + **Circle + Circle Jr HeLO history** + RSVP/raincheck |

---

## Summary

**Tactika today** is a four-tool suite (Climbing Guide, Stratmaker, Micro Prep, Routeplanner) on a shared auth/hub/calendar/roster stack with live collab, plus a **Match Brief** hub for match-night prep (linked tools + prep tasks), **imported HeLO history for Circle and Circle Jr**, per-player **My matches** / combat form, Hub RSVP, and Management **Match + Strat history**.

**Planned work** clusters around Discord bot/membership sync, create-match wizard, deeper CRCON/HLLRecords profile links, and cross-linking — see [#33](https://github.com/Djurre1981/hll-tactika-test/issues/33) for the ordered checklist. **Member wiki:** in-app **?** help (source `docs/wiki`) · Roles: [`roles.md`](./roles.md).

*Updated July 23, 2026*
