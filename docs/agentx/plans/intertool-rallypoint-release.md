# Plan: Intertool + RallyPoint closed release (#33 → #23)

## Goal
Ship an Event-centric Match Brief product so Circle can schedule, prep, RSVP, and review matches from one hub before closed release. **Tactika is new** — Circle today runs match ops on **Stratsketch** (nearly everything), **Apollobot** (signups), and **Google Sheets** (roster). This release wires Tactika’s Strat / Routeplanner / Micro Prep / Calendar / Roster into one hub and cuts over from those external tools. **Membership, roles, roster, and match notifications are driven from Circle Discord**; Tactika replaces Apollobot + Sheets as the roster/notification system of record.

## Agreed decisions (from lead gate)
- UI / framework: React hub + Cloudflare Pages Functions (existing)
- Data storage: D1 Event hub with `components_json` on `events` (IDs for strats, route plans, whiteboards, optional rosterId) — not soft-links-only for the canonical index
- **Identity & auth (clarified):** Circle Discord is the **userbase source**. Import members + Discord role properties; map those roles onto Tactika site roles (`viewer` / `editor` / `assist` / `admin` / `owner`). **Authorization depends on that mapping.** Tactika takes over roster + notifications currently handled by Apollobot (new event, event in X minutes, additional signup required, etc.).
- **Login (Q2A):** Keep **Steam sign-in**. Sync Discord members/roles into D1; require **Steam ↔ Discord account linking** so authorization can use Discord-mapped roles while HLL identity stays Steam.
- **Roster (Q3B):** **Live sync from Circle Discord** is source of truth for roster membership. Optional one-shot Apollobot export import for history; then Apollobot is retired for weekly ops (no dual-run).
- Blind-spot defaults included: reverse links kept (`routePlan.eventId`, later `strat.eventId`); no public anonymous events; RSVP for mapped+linked members; soft-fail Discord sync if guild unreachable; env `OWNER_*` remains emergency bootstrap only
- Explicitly skipped for later (optional GH issues, not closed-release blockers): #2 rich text, #3 strat images, #4 line/arrow, #7 icon anim, #8 visibility, #9/#10 microprep UX, #12 RCON/inbox-as-generic-platform, #13 engagement XP — **except** Discord signups/notifications that #23 / Apollobot replacement already requires
- Closed-release gate: **#33 foundation + #23 RallyPoint features + Discord membership/roster takeover**
- Discord depth (**Q1B**): Full Discord bot — slash commands, two-way calendar, notifications, **member/role import & sync**
- **Discord rollout:** Build the bot now, but **run and QA only on a separate test Discord server first** (behaviour + security). Promote to Circle production guild only after that pass. No production guild sync/auth cutover until test-server sign-off.
- Lead Qs resolved: Q1B, Q2A, Q3B — ready for implementation after user OK

## Isolation lane
**worktree** (or sequential local on `ducttape`) — one writer per layer; never parallelize two tasks that both own `events-store.js`, `users-store.js`, or `HomePage.jsx`

## Assumptions
- Existing tools (strats, route plans, whiteboards, calendar) stay; we glue, not rewrite
- Comp roster in Tactika **absorbs** Apollobot-managed lineup/attendance; Apollobot is retired for Circle match ops after cutover
- Steam ID remains the login + HLL-facing identity; Discord ID is linked on the user row and drives role/roster sync (Q2A)
- Discord guild roles are the source of **who exists** and **what Tactika role they get** (via a configurable role map)
- Comp roster **live-syncs from Discord** (Q3B); Apollobot one-shot import optional, then retired
- Bot is developed against a **test Discord guild** first (`DISCORD_GUILD_ID` = test server). Production Circle guild ID is a second env profile, switched only after security/behaviour sign-off
- Notifications go out via Discord bot DMs and/or channel posts (not email for closed release)

## Discord membership & Apollobot takeover (new critical path)

```
T0a Discord bot skeleton + guild member fetch
  ├─→ T0b Role map config (Discord role ID → Tactika role)
  ├─→ T0c Member sync + Steam↔Discord link → D1 users (Q2A)
  │     └─→ Auth uses Discord-mapped role after link (env allowlist = bootstrap only)
  ├─→ T0d Roster live-sync from Discord (Q3B; Apollobot one-shot then retire)
  └─→ T0e Notification service (new event, T−24h/T−1h, signup needed, fill needed)
        └─→ used by T4/T6/T7/T12*
```

**Hard rule:** Do not ship closed release with manual Steam env allowlist as the only membership path — Discord import/sync must be live (or documented cutover complete).

**Hard rule (test server):** T0a–T0e and T12* must prove on the **test Discord server** before any Circle production guild token/guild ID is used for member sync, role mapping, or auth cutover.

## Dependency graph (hard rules)

```
T0a–T0e Discord identity, roles, roster takeover, notifications
  │
T1 Event hub schema+API
  ├─→ T2 Match metadata on events
  │     ├─→ T3 Match Brief page (needs T1+T2)
  │     ├─→ T4 Match creation wizard (needs T1+T2; creates event+strat+attachments)
  │     │     └─→ fires T0e “new event available”
  │     └─→ T8 Match reports / history (needs T2 results)
  ├─→ T5 Attach UI (strat/route/board/roster) — after T1; Brief needs it
  ├─→ T6 RSVP model — needs T1 + T0c members
  │     ├─→ T7 Hub next-match card — needs T6 (+ T3)
  │     └─→ T6b Fill / “additional signup required” — needs T6 + T0e
  ├─→ T9 Prep tasks — needs T1; Brief after T3
  ├─→ T10 Dashboard KPIs / analytics — after T2
  ├─→ T11 Roster templates + stats — after T0d; soft dep T6
  └─→ T12a webhook + reminders — needs T2 (+ T0e)
        └─→ T12b slash + two-way calendar — needs T12a + T0a + T1–T3
```

**If X is not built, Y cannot ship:**

| Missing | Blocks |
|---------|--------|
| T0a bot + guild access | Import, roster sync, slash, notifications |
| T0b role map | Authorization from Discord roles |
| T0c member sync | Who can log in / what they can do |
| T0d roster takeover | Match Brief roster; retire Apollobot |
| T0e notifications | “New event”, “in X minutes”, “signup required” |
| T1 Event hub | Match Brief, wizard attach, RSVP, prep tasks |
| T2 Match metadata | Wizard, Brief facts, reports, Discord embed richness |
| T3 Match Brief | Day-of command; hub deep links |
| T6 RSVP | Live RSVP counter, fill/signup prompts |
| T12b Discord bot slash/sync | Closed release (**Q1B**) |

## Tasks (Agentx layers)

| ID | Task | Writes (ownership) | Depends on | Verify |
|----|------|--------------------|------------|--------|
| T0a | Discord bot host + guild member/role list APIs (**test guild only**) | `discord-bot/` or `server/discord/`, secrets docs (`DISCORD_*_TEST`) | — | bot online on **test server**; list members+roles in dry-run; no Circle prod guild config in default env |
| T0b | Configurable Discord role → Tactika role map | `functions/lib/discord-role-map.js`, env or D1 `settings`, admin UI optional | T0a | map Comp Admin Discord role → `admin`; unmapped → deny or `viewer` per policy |
| T0c | Member sync + **Steam↔Discord link (Q2A)**; auth uses Discord-mapped role after link | `migrations/*_discord_users.sql`, `users-store.js`, link UI/API, `roles.js` / auth | T0b | sync by discord_id; Steam user links Discord; role follows Discord map; revoke on guild leave |
| T0d | Roster live-sync from Discord (Q3B); optional one-shot Apollobot import; retire Apollobot checklist | `roster-store.js`, import script, Management “Sync from Discord” | T0c | roster matches guild; Apollobot not required weekly |
| T0e | Notification service: new event, event in X min, additional signup required, fill needed | `functions/lib/notifications.js`, bot DM/channel templates, preference flags later | T0a, T0c | trigger dry-run logs + one real channel post in staging |
| T1 | Event hub: `components_json` + attach/detach API + sanitize | `migrations/0014_*.sql`, `functions/lib/events-store.js`, `functions/api/events*.js`, `src/features/calendar/hooks/useEventsQuery.js` | — (can parallel T0*) | migrate local; attach IDs; GET returns components |
| T2 | Match metadata on events | events store/API + `EventForm.jsx` | T1 | create/edit match fields; round-trip |
| T3 | Match Brief page | `src/features/events/**`, `router.jsx` | T1, T2 | open linked assets; empty states |
| T4 | 5-step match wizard + notify “new event” | `MatchWizard.jsx` + T0e hook | T1, T2, T0e | event+strat; Discord notified |
| T5 | Attach/detach UI on Brief | `EventComponentsPanel.jsx` | T1, T3 | attach/detach; route `eventId` sync |
| T6 | RSVP table + Brief bar | `rsvps` migration/store/API | T1, T0c | member RSVP; counts | ✅ |
| T6b | Raincheck + waitlist fill | `0023_rsvp_raincheck.sql`, RaincheckFlow, seats | T6 | raincheck reason flow; promote waitlist | ✅ web (T0e notify stub) |
| T7 | Hub next-match hero | `HomePage.jsx`, `NextMatchHero.jsx` | T3, T6 | countdown; RSVP; Brief link | ✅ |
| T8 | Match reports / history | `src/features/records/` or management | T2 | past results list |
| T9 | Prep tasks | `prep_tasks` migration/store/API + Brief | T1, T3 | assign/complete |
| T10 | KPIs + analytics charts | Hub KPI + AnalyticsSection | T2 | empty-safe |
| T11 | Roster templates + attendance stats | roster store/UI | T0d, T6 soft | duplicate/template |
| T12a | Webhook posts + cron reminders (uses T0e) | `discord-events.js`, cron | T2, T0e | staging webhook/reminder |
| T12b | Slash `/event create`, `/calendar`, two-way sync, Post-to-Discord | bot + `functions/api/discord/*` | T12a, T0a–T0c, T1–T3 | slash + sync QA in guild |

## Integration order (merge sequence)

1. **T0a → T0b → T0c** — Discord bot + role map + member sync (**auth critical path**; own worktree `agentx/discord-members`)
2. **T0d** roster takeover + **T0e** notifications (after T0c)
3. **T1 → T2** Event hub (can start in parallel with T0a if different owners; merge T0c before relying on Discord-gated auth in prod)
4. **T3 → T5** Match Brief + attach
5. **T4** wizard (after T0e so “new event” notifies)
6. **T6 → T7** RSVP + hub card
7. **T9** prep tasks
8. **T8 + T10** reports/analytics (parallel OK)
9. **T11** roster polish
10. **T12a → T12b** outbound + slash/two-way

Integrator: never merge prod auth cutover without T0b+T0c verified; never call closed release done without T0d + T0e + T12b.

## One-shot agent prompts (copy-paste)

Each prompt is self-contained. Agent must: branch `agentx/<id>-…`, own only listed paths, verify, stop for PR (no merge unless asked).

### Prompt T0a — Discord bot + guild member fetch

```
You are implementing Agentx task T0a for closed-release Discord membership (issues #23/#33, plan docs/agentx/plans/intertool-rallypoint-release.md).

GOAL: Discord bot that can list guild members and their Discord roles on a **dedicated TEST Discord server** (not Circle production). No auth cutover. Document separate env profiles: test vs prod guild.

WRITE ONLY: discord-bot/ or server/discord/**, package scripts, .env.example for DISCORD_BOT_TOKEN, DISCORD_GUILD_ID (test), DISCORD_APP_ID. Document how to run against test server only.

SELF-CHECK:
- [ ] Dry-run prints member count + sample roles from **test guild** (redact tokens)
- [ ] README states: do not point default config at Circle prod until security sign-off
- [ ] Fails clearly if token/guild missing
- [ ] Shared-config: tell user before adding any production secrets
Stop for PR. Plan T0a.
```

### Prompt T0b — Discord → Tactika role map

```
You are implementing Agentx task T0b (needs T0a).

GOAL: Configurable mapping Discord role IDs → Tactika roles (owner|admin|assist|editor|viewer). Highest Discord role wins. Unmapped members: deny access (recommended) unless config says viewer. Use **test guild role IDs** in fixtures; document that Circle prod needs a separate map.

WRITE ONLY: functions/lib/discord-role-map.js (+ optional D1 settings or env JSON DISCORD_ROLE_MAP). Admin readme for mapping Discord roles. Do not change login UI yet.

SELF-CHECK:
- [ ] Unit/fixture: given role ID set → expected Tactika role
- [ ] Document example map for Comp Member / Advisor / Assist / Admin (test guild)
- [ ] Note: prod guild role IDs must be remapped at promote time
Stop for PR. Plan T0b.
```

### Prompt T0c — Member import/sync + auth

```
You are implementing Agentx task T0c (needs T0b). CRITICAL: authorization depends on this.

GOAL: Sync Discord guild members into D1 users with discord_id + mapped role. **Steam remains login (Q2A).** Add Steam↔Discord account linking (user connects Discord while Steam-authed, or admin links). Auth resolution: after link, Discord-mapped role drives canEnterEditorMode / admin gates; env OWNER_* remains emergency bootstrap only. Unlinked policy: document clearly (recommended: viewer-denied or read-only until linked).

WRITE ONLY: migration for discord_id (+ link token fields if needed), users-store sync, sync job/API (admin-only), link endpoints/UI under team/settings, auth path updates in functions/lib/roles.js + auth as needed. Do not rewrite roster tables (T0d).

SELF-CHECK:
- [ ] Sync upserts members by discord_id
- [ ] Steam user can link Discord; role updates after sync
- [ ] Leaving guild revokes or marks inactive per policy
- [ ] Unlinked behavior matches documented policy
- [ ] npx vite build; migrate local
- [ ] STOP before removing env allowlists in production
Stop for PR. Plan T0c.
```

### Prompt T0d — Roster takeover (replace Apollobot)

```
You are implementing Agentx task T0d (needs T0c). Tactika replaces Apollobot for Circle roster.

GOAL: **Live sync from Circle Discord is roster source of truth (Q3B).** Optional one-shot Apollobot CSV/JSON import for history. Ongoing: Management “Sync from Discord” (or cron) updates roster_members from guild. Document Apollobot retirement checklist — no dual-run.

WRITE ONLY: roster store/import script, Management roster sync action, migrations if needed. Do not build Match Brief.

SELF-CHECK:
- [ ] Discord sync creates/updates roster_members (discord_id, display, links)
- [ ] Optional Apollobot import does not fight live sync (import once, then Discord wins)
- [ ] Ops doc: cut over from Apollobot
- [ ] npx vite build
Stop for PR. Plan T0d.
```

### Prompt T0e — Notification service

```
You are implementing Agentx task T0e (needs T0a+T0c).

GOAL: Notification helpers the rest of the app calls: (1) new event available (2) event in X minutes (3) additional signup required (4) fill needed. Deliver via Discord channel and/or DM using bot. Templates + idempotency keys so cron doesn’t spam.

WRITE ONLY: functions/lib/notifications.js (+ discord send helpers), optional notification_log table. Wire one admin “test notify” endpoint. Do not build full RSVP UI (T6) but accept event_id + steam/discord targets.

SELF-CHECK:
- [ ] Test endpoint posts to staging channel
- [ ] Duplicate send with same idempotency key no-ops
- [ ] Missing webhook/bot fails soft with log
Stop for PR. Plan T0e.
```

### Prompt T1 — Event hub schema + API

```
You are implementing Agentx task T1 for https://github.com/Djurre1981/hll-tactika-test/issues/33 (Intertool) on branch ducttape lineage.

GOAL: Add Event hub storage so an event owns component IDs (stratIds, routePlanIds, whiteboardIds, rosterId).

WRITE ONLY: migrations/0014_event_components.sql (or next free), functions/lib/events-store.js, functions/api/events.js, functions/api/events/[eventId].js, src/features/calendar/hooks/useEventsQuery.js (types/normalize only if needed). DO NOT build Match Brief UI.

DO:
1. Add components_json TEXT NOT NULL DEFAULT '{}' on events (or equivalent).
2. Sanitize shape: { stratIds:[], routePlanIds:[], whiteboardIds:[], rosterId:null }.
3. PATCH event supports replacing/merging components; optional POST /api/events/:id/components {action:attach|detach, type, id}.
4. Validate IDs exist when attaching (query strats/route_plans/whiteboards/rosters). Auth: editor+ for mutate; any auth member for GET.
5. Backfill-compatible: empty components OK; do not break existing calendar CRUD.

SELF-CHECK (must pass before claiming done):
- [ ] npm run db:migrate:local (or document if blocked)
- [ ] npx vite build
- [ ] Manual/API: create event → attach fake-valid IDs fails; attach after creating real resources succeeds OR unit-level store test
- [ ] GET event returns components_json normalized
- [ ] No edits outside ownership paths
Write short notes in PR body. Do not merge. Cite plan docs/agentx/plans/intertool-rallypoint-release.md T1.
```

### Prompt T2 — Match metadata

```
You are implementing Agentx task T2 (depends on T1 merged). Issue #23 match scheduling fields + #33.

GOAL: Extend events with match metadata: opponent, mapId, faction/side, startingPoint optional, result optional — stored on event (match_json or columns). Update EventForm for editors.

WRITE ONLY: events store/API sanitize, EventForm.jsx / DayDetails display, calendar-utils if needed. Do not build wizard or Brief.

SELF-CHECK:
- [ ] Create/edit event with map+faction+opponent; reload persists
- [ ] Events without match metadata still work (practice/other)
- [ ] npx vite build
- [ ] Auth unchanged (editor+ write)
Stop for PR. Plan: docs/agentx/plans/intertool-rallypoint-release.md T2.
```

### Prompt T3 — Match Brief page

```
You are implementing Agentx task T3 (needs T1+T2). Issue #23 “One-screen match command”.

GOAL: New Match Brief page that loads event by id and shows: title, time, match metadata, linked components (titles+deep links to /strats/:id, /routeplanner/:id, /micro-prep/:id), roster summary if rosterId set. Empty states when nothing linked.

WRITE ONLY: src/features/events/** (new), router.jsx route, Hub/Calendar “Open brief” link only if one-liner. Do not implement RSVP or wizard yet.

SELF-CHECK:
- [ ] /events/:id (or chosen path) works authenticated
- [ ] Broken component IDs show “missing” not crash
- [ ] npx vite build
- [ ] Viewer can open read-only
Stop for PR. Plan T3.
```

### Prompt T4 — Match creation wizard

```
You are implementing Agentx task T4 (needs T1+T2; Brief T3 preferred). Issue #23 5-step wizard.

GOAL: Wizard: (1) opponent+date (2) map (3) faction (4) create or pick strat (5) review → creates calendar event with match metadata + components.stratIds + optional new strat with match_json aligned. On success call notifications “new event available” (T0e).

WRITE ONLY: src/features/events/MatchWizard* + entry from Calendar/Hub; thin hook to notifications API. Reuse strat create API.

SELF-CHECK:
- [ ] Completing wizard creates event visible on calendar
- [ ] Strat appears in components and opens in Stratmaker
- [ ] Notification fired or soft-failed with log
- [ ] Esc/cancel leaves no half-linked junk (or documents cleanup)
- [ ] npx vite build
Stop for PR. Plan T4.
```

### Prompt T5 — Attach UI

```
You are implementing Agentx task T5 (needs T1+T3).

GOAL: On Match Brief, UI to attach/detach existing strat, route plan, whiteboard, roster (search/select). Keep reverse routePlan.eventId in sync when attaching route plans (set/clear eventId).

WRITE ONLY: EventComponentsPanel + Brief wiring; minimal routeplanner sync if needed in route-plans PUT from Brief attach helper.

SELF-CHECK:
- [ ] Attach/detach each type; Brief list updates
- [ ] Route plan eventId matches when attached
- [ ] npx vite build
Stop for PR. Plan T5.
```

### Prompt T6 — RSVP

```
You are implementing Agentx task T6 (needs T1). Issue #23 RSVP tracking.

GOAL: D1 rsvps(event_id, steam_id, status confirmed|tentative|declined|unavailable), API GET/PUT for self, editor can list all. RSVP segmented bar on Match Brief.

WRITE ONLY: migration, rsvps-store, events/.../rsvps API, Brief RSVP UI. No Hub hero yet (T7).

SELF-CHECK:
- [ ] Member can change own RSVP
- [ ] Counts correct; unique per (event, steam)
- [ ] npx vite build + migrate local
Stop for PR. Plan T6.
```

### Prompt T7 — Hub next-match card

```
You are implementing Agentx task T7 (needs T3+T6). Issue #23 live RSVP counter.

GOAL: Hub HomePage next match hero: countdown, RSVP progress, I’m in / Can’t, link to Match Brief.

WRITE ONLY: HomePage.jsx, useDashboardQuery.js (and small presentational components under features/home/). Do not redesign entire dashboard tools grid.

SELF-CHECK:
- [ ] With upcoming event: card shows; RSVP buttons work
- [ ] No upcoming: graceful empty
- [ ] npx vite build
Stop for PR. Plan T7.
```

### Prompt T8 — Match reports / history

```
You are implementing Agentx task T8 (needs T2). Issue #23 match reports & history / HLL Records slice.

GOAL: List past events with result set (or strat match_json) as searchable history; detail uses Match Brief or a thin report summary.

WRITE ONLY: src/features/records/** or management History section + hub tile enable if placeholder. Prefer reading events+components over new matches table unless aggregation needs it.

SELF-CHECK:
- [ ] Past matches list; filter by map/opponent if easy
- [ ] npx vite build
Stop for PR. Plan T8.
```

### Prompt T9 — Prep tasks

```
You are implementing Agentx task T9 (needs T1+T3). Issue #23 player prep assignments.

GOAL: prep_tasks table; editor assigns tasks to steam_ids; assignees toggle completed; show on Brief + “My tasks” on Hub.

WRITE ONLY: migration, store, API, Brief checklist, small Hub widget.

SELF-CHECK:
- [ ] Assign/complete permissions correct
- [ ] npx vite build
Stop for PR. Plan T9.
```

### Prompt T10 — KPIs + analytics

```
You are implementing Agentx task T10 (needs T2 data). Issue #23 dashboard KPIs + visual analytics.

GOAL: Aggregate win/loss from event results and/or strat match_json; show KPI strip on Hub; charts on Management Analytics (Recharts or Chart.js — pick one already in repo or add with lockfile note).

WRITE ONLY: aggregation helper, HomePage KPI, AnalyticsSection.jsx. No new event schema.

SELF-CHECK:
- [ ] Empty data safe
- [ ] npx vite build
- [ ] Call out lockfile if new dep
Stop for PR. Plan T10.
```

### Prompt T11 — Roster templates + stats

```
You are implementing Agentx task T11. Issue #23 roster templates + data-driven stats.

GOAL: Duplicate roster + template flag; optional attendance rate from RSVPs when T6 present.

WRITE ONLY: roster store/API + RosterSection UI. Do not modify events-store.

SELF-CHECK:
- [ ] Duplicate creates new roster with memberships copied
- [ ] npx vite build
Stop for PR. Plan T11.
```

### Prompt T12a — Discord webhook + reminders

```
You are implementing Agentx task T12a (needs T2 + T0e). Issue #23 Discord event push + scheduled reminders. Prefer T0e notification helpers; webhook is a channel delivery path.

GOAL: On match/event create (and “Post to Discord” button), post via T0e / webhook with title, time, map, Match Brief link. Cron: 24h and 1h → “event in X minutes”. Soft-fail if bot/webhook missing.

WRITE ONLY: functions/lib/discord-*.js (or extend notifications.js), event create hook, wrangler cron if required. Document env vars.

SELF-CHECK:
- [ ] Staging dry-run: no throw when unset
- [ ] Reminder path uses T0e idempotency
- [ ] npx vite build
- [ ] Shared-config: stop and tell user if wrangler.toml cron added
Stop for PR. Plan T12a.
```

### Prompt T12b — Discord bot + two-way calendar (closed-release blocker)

```
You are implementing Agentx task T12b (needs T12a + T0a–T0c + T1–T3). Issue #23 Discord bot / slash / two-way sync. Closed release REQUIRES this (lead Q1B). Members/roles already synced by T0*.

GOAL:
1. Slash: /event create — creates Tactika calendar event (auth via Discord member sync / linked Steam).
2. Slash: /calendar — week’s events + Match Brief links.
3. Two-way calendar sync; store discord_event_id on events.
4. Calendar UI: “Post to Discord” on any event.
5. Reuse T0e notifications + T12a helpers.

WRITE ONLY: discord-bot slash handlers, functions/api/discord/* (verify signature), events-store discord ids, thin Calendar/Brief button. Shared-config: STOP before production secrets/host changes.

SELF-CHECK:
- [ ] /calendar and /event create work in test guild for mapped roles only
- [ ] Unmapped Discord user cannot escalate privileges via slash
- [ ] Tactika↔Discord sync; invalid signature rejected
- [ ] npx vite build; bot dry-run without token does not crash
Stop for PR. Human QA in Discord required. Plan T12b.
```

## Done when (closed release)

### Gate A — Test Discord server (required before Circle)
- [ ] Discord bot online on **test guild**; members/roles fetchable (T0a)
- [ ] Behaviour + security sign-off on test server
- [ ] Discord → Tactika role map on test; Steam↔Discord link + auth verified (T0b+T0c)
- [ ] Roster live-sync on test; Apollobot cutover docs ready (T0d)
- [ ] Notifications on test channels (T0e): new event, in X min, signup/fill

### Gate B — Product (can progress in parallel with Gate A after T0a skeleton)
- [x] Event hub stores and returns component IDs (T1) — [#34](https://github.com/Djurre1981/hll-tactika-test/pull/34)
- [x] Match metadata on events (T2) — [#35](https://github.com/Djurre1981/hll-tactika-test/pull/35), migration `0016` on remote
- [x] Match Brief opens from calendar/hub and shows linked tools (T3) — [#39](https://github.com/Djurre1981/hll-tactika-test/pull/39)
- [x] Match Brief attach/detach UI (T5) — `3f53569`
- [x] Prep tasks on Brief (T9) — `d7cb96b`, migration `0017` on remote
- [x] Match history / HLL Records (T8)
- [x] Event lock + linked-tool propagation (`0018_event_lock.sql`)
- [x] Per-tool lock in Stratmaker / Routeplanner / Micro Prep (`0019_tool_lock.sql`)
- [x] Team KPIs + Analytics charts (T10) — `7612e62`, fix `091d326` (`/management#analytics`)
- [x] HeLO Circle history import + `participantSteamIds` / My matches — `3c6f1f8`, remote D1 apply `e0572bc`; ops [`docs/helo-import.md`](../../helo-import.md)
- [ ] Roster duplicate/template (T11)
- [ ] Discord webhook + reminders on test (T12a)
- [ ] Slash `/event create`, `/calendar`, two-way sync on **test guild** (T12b)

### Gate C — Circle production promote
- [ ] Separate prod env: guild ID, bot token, **new** role map (do not copy test role IDs)
- [ ] Member/roster sync + notifications + T12b QA on Circle guild
- [ ] `npx vite build` green; migrations applied; bot docs for test + prod profiles
- [ ] Optional issues (#2–#13 except #23/#33) still open OK

## Risks
- **Test→prod promote:** role IDs differ between test and Circle guilds — role map must be reconfigured per guild; never copy test role IDs to prod blindly
- **Steam↔Discord link (Q2A):** linking UX is mandatory for full auth; unlinked policy must be explicit
- **Apollobot cutover (Q3B):** live Discord sync wins after optional one-shot import — dual-run causes drift
- **Discord membership on auth path:** wrong role map = wrong privileges; dry-run on test server first
- **Discord bot ops:** hosting, secrets, guild install, interaction verification — isolate test bot token from prod
- **Two-way sync edge cases:** edits/deletes; external IDs; duplicate events
- **Schema ownership:** one agent at a time on `events-store.js` / `users-store.js`
- **Duplicate match metadata:** strat `match_json` vs event fields
- **Notification spam:** idempotency + preference defaults; test channel only until promote
- **Cron on Pages:** Workers cron may be required; flag shared-config early

## Related issues
- Must: #33 (foundation), #23 (product + Discord/Apollobot takeover)
- Absorb into hub: #5, #11 (roster↔tools attach), signup/notification pieces of #12
- Optional / not blocking closed release: #2, #3, #4, #7, #8, #9, #10, #13, #15
