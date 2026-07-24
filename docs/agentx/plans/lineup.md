# Plan: Match LineUp (v1)

## Goal
Ship a Match Brief–attached LineUp board so Admin/Owner assign RSVP-confirmed players into sector-colored squads (nodes overlay + reserves), sized by event `rosterSize` (49 / 36 / 18), with hard validation, lock, live multi-admin edit, and manual presence checkboxes.

## Agreed decisions (from lead gate)
- UI / framework: existing React hub + Match Brief `components` pattern
- Data storage: D1 (new migration); lineup entity + `components.lineupId`; event `rosterSize` 49|36|18
- Auth: Steam allowlist; **view** Member+; **edit/lock/force-RSVP** Admin/Owner (`canManageTeam` / `requireAdmin`)
- Blind-spot defaults included: live Yjs collab; manual presence fields; mobile-friendly board; block invalid saves
- Explicitly skipped for later: Discord Briefing presence bot; merc auth/scoping; audit log

See also: `docs/agentx/plans/lineup-lead-review.md`

## Isolation lane
local

## Assumptions
- `signup_target` stays RSVP capacity; **`rosterSize` is separate** (playing slots for LineUp layouts).
- Force-RSVP reuses existing `forceConfirm` RSVP API; LineUp UI exposes it to Admin/Owner only.
- Default layouts encode Circle’s usual sector/squad structure for 49 / 36 / 18 (editable after create).
- Presence checkbox is show/no-show only in v1 (bot fills same fields later).
- Auto-lock uses event end time from existing event/match fields; if missing end time, Admin lock only.

## Open (non-blocking — decide in T2 if needed)
- Exact default squad counts per size (derive from screenshot + ECL 49; document in layout module).

## Tasks

| ID | Task | Writes (ownership) | Depends on | Verify |
|----|------|--------------------|------------|--------|
| T1 | **Schema + store + API + validation** — migration `roster_size` on events; `lineups` table (`id`, `event_id`, `locked`, `locked_at`, `layout_json` or normalized slots, `updated_at`); extend `components_json` with `lineupId`; CRUD + assign/unassign/presence/lock endpoints; server validation (roster size, ≤20 squads, squad type caps, nodes overlay rules, player must be confirmed RSVP); auto-lock helper after match end | `migrations/0024_*.sql`, `functions/lib/lineups-store.js`, `functions/lib/lineup-validate.js`, `functions/api/lineups/**`, `functions/lib/events-store.js` (sanitize components + rosterSize), `tests/migrations.test.mjs` (assert migration) | — | `npm run db:migrate:local`; API unit/integration tests for validate + RSVP gate |
| T2 | **Default layouts** — pure modules for 49 / 36 / 18: sectors, colors, squad types/slots, empty nodes N/Mid/S (3 Supp+1 Eng + SL-for-nodes), reserves empty; create-from-template on lineup create | `src/features/lineup/layouts/*.js` (or `functions/lib/lineup-layouts.js` shared), short comment doc in module | T1 (shape must match store) | Snapshot/unit test: layout squad count ≤20; playing slots == rosterSize |
| T3 | **Event form + Match Brief attach** — roster size picker on create/edit; chip + open/attach/detach LineUp on Brief (Admin attach like roster); route `/events/:eventId/lineup` or `/lineups/:id` | `src/features/events/EventForm.jsx`, `EventComponentsPanel.jsx`, `EventComponentAttachControls.jsx`, `event-brief-utils.js`, `useEventComponentActions.js`, `functions/api/events/[eventId]/components.js`, `src/app/router.jsx` | T1 | Create event with rosterSize 36 → attach lineup → Brief shows chip |
| T4 | **LineUp board UI** — sector-colored board; multi-squad sectors; assign from RSVP pool; reserves; nodes overlay; presence checkboxes; force-RSVP control; lock/unlock; mobile layout; block invalid drops with reason | `src/features/lineup/**` (page, board, slot, nodes, reserves, hooks) | T1, T2, T3 | Manual: fill board, oversize blocked, nodes require infantry slot, presence toggles persist |
| T5 | **Live multi-admin collab** — Yjs room `lineup:<id>`; join auth Admin for write / Member read-only awareness optional; persist snapshot like whiteboard | `functions/lib/collab-rooms.js`, `functions/api/collab/join.js` (room allowlist), `src/features/lineup/useLineupCollab.js` (uses `useYjsRoom`) | T1, T4 shell | Two Admin sessions see slot moves without refresh |
| T6 | **Tests + wiki** — API/validation tests; brief attach test; wiki page for LineUp + update Calendar/Match Brief + Roles | `tests/*lineup*`, `docs/wiki/LineUp.md`, `docs/wiki/Calendar-and-Match-Brief.md`, `docs/wiki/_Sidebar.md`, `docs/wiki/Roles-and-Permissions.md` | T1–T5 | `npm test` (relevant); wiki links resolve |

## Integration
Who merges / in what order:

1. **T1** first (schema/API is the contract).
2. **T2** in parallel once T1 slot JSON shape is sketched (or immediately after T1 lands shape).
3. **T3** after T1 (attach needs `lineupId`).
4. **T4** after T2+T3 (UI needs layouts + route).
5. **T5** after T4 board state exists (collab binds to same document).
6. **T6** last (docs/tests catch drift).

**Collision watch:** `events-store.js` / `EventComponentsPanel.jsx` / `components.js` — only **T1+T3** write these; T4+T5 stay in `src/features/lineup/**` + collab libs.

## Done when
- [x] Event has `rosterSize` ∈ {49,36,18}; default lineup layout matches size
- [x] Match Brief: attach/open LineUp; Members view; Admin/Owner edit
- [x] Assign only confirmed RSVPs; Admin force-RSVP backdoor works
- [x] Hard rules block save (roster count, 20 squads, type caps, nodes overlay rules)
- [x] Reserves + nodes overlay + manual presence checkboxes work
- [x] Admin lock/unlock; auto-lock after match end time
- [x] Live multi-admin editing works
- [x] Board usable on mobile
- [x] Tests + wiki updated
- [x] Discord bot + merc auth **not** in this release

## Risks
- Yjs vs D1 dual source of truth — follow whiteboard pattern (collab live + periodic/explicit save to D1).
- Confusing `signup_target` vs `rosterSize` — label clearly in Event form (“RSVP seats” vs “LineUp size”).
- Default 49 layout may need one tweak pass with managers after first use.
