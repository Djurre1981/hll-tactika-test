# Closed-release peer playbook

**Who this is for:** You and a peer building the Circle “match night” product without guessing order.  
**Related issues:** [#33 Intertool](https://github.com/Djurre1981/hll-tactika-test/issues/33) · [#23 RallyPoint features](https://github.com/Djurre1981/hll-tactika-test/issues/23)  
**Tech plan (agents):** [`intertool-rallypoint-release.md`](./intertool-rallypoint-release.md)

---

## How to use this (2 minutes)

1. Open the **Progress board** below — find the first unchecked step whose **Depends on** are all done.
2. That step is **NEXT**.
3. Copy the **One-go prompt** into Cursor.
4. When the agent opens a PR, run the **Verify** checklist yourself (or have the agent run it and paste results).
5. Check the box here / on issue #33 when merged.

**Rule:** One step at a time. Do not start a step whose dependencies are open.

---

## Progress board

| Status | Step | Plain name | Depends on |
|--------|------|------------|------------|
| ✅ Done | **T1** | Event backpack (data hooks) | — |
| ✅ Done | **T2** | Match details on calendar events | T1 — [#35](https://github.com/Djurre1981/hll-tactika-test/pull/35) |
| ✅ Done | **T3** | Match Brief page | T1, T2 — [#39](https://github.com/Djurre1981/hll-tactika-test/pull/39) |
| ✅ Done | **T5** | Attach/detach tools on Brief | T1, T3 — `3f53569` |
| ⬜ **Next (product)** | **T4** | Create-match wizard | T1, T2, T0e |
| ⬜ Next candidates | **T0a** | Test Discord bot (read members) | — |
| ⬜ | **T0b** | Map Discord roles → Tactika roles | T0a |
| ⬜ | **T0c** | Sync members + Steam↔Discord link | T0b |
| ⬜ | **T0d** | Roster from Discord (replace Apollobot) | T0c |
| ⬜ | **T0e** | Notification messages | T0a, T0c |
| ⬜ | **T6** | RSVP “I’m in / can’t” | T1, T0c |
| ⬜ | **T7** | Hub next-match card | T3, T6 |
| ⬜ | **T9** | Prep task checklist | T1, T3 |
| ⬜ | **T8** | Match history / records | T2 |
| ⬜ | **T10** | Team win/loss stats | T2 |
| ⬜ | **T11** | Roster templates | T0d (T6 helps) |
| ⬜ | **T12a** | Discord posts + reminders | T2, T0e |
| ⬜ | **T12b** | Discord slash commands + two-way calendar | T12a, T0a–T0c, T1–T3 |
| ⬜ | **Gate C** | Promote bot to Circle production Discord | All of Gate A + B on **test** server |

**Suggested next:** **T4** (create-match wizard — blocked on T0e) *or* **T0a** (Discord path). **T8/T10/T9** also unblocked.

---

## The plan in plain English

### What we’re building

**Tactika is new.** Circle does not run match ops in Tactika yet.

**How Circle works today (outside Tactika):**
- **[Stratsketch](https://stratsketch.com)** — nearly everything for strats / prep visuals
- **Apollobot** — Discord signups / attendance-style flow
- **Google Sheets** — roster

Before a match, people bounce between those tools. We are building Tactika as the **single match-night hub** that replaces that split:

1. A **calendar event** (scrim / practice / comp / other) becomes the folder for that night.
2. That event can hold links to a **strat**, **route plan**, **whiteboard**, and **roster** (the “backpack”) — Tactika’s own tools, not Stratsketch glue.
3. A **Match Brief** page opens that folder and shows everything in one screen.
4. Players can **RSVP**, see a **countdown** on the home dashboard, get **Discord pings**, and we retire **Apollobot** + the **Sheets roster** by syncing people from Discord into Tactika.

Inspired by [RallyPoint](https://www.rallypoint.fyi/) ideas (#23). The Stratmaker / Routeplanner / Micro Prep / Calendar / Roster pieces in this repo are the **new** stack we’re wiring together for closed release — not a polish pass on an already-live Circle product.

### Where things live in the app

| Piece | Where the user sees it |
|-------|-------------------------|
| Calendar event | Hub → **Calendar** |
| Event “backpack” (links) | Stored on the event (API today; UI on Match Brief) |
| Match Brief | New page e.g. `/events/…` — “open brief” from calendar/hub |
| Create-match wizard | Starts from Calendar / Hub → walks you through opponent, map, side, strat |
| RSVP + countdown | Match Brief + **Home** dashboard card |
| Prep tasks | Match Brief + “my tasks” on Home |
| History / KPIs | Home strip + Management / Records |
| Roster sync | **Management → Roster** |
| Discord bot | Test Discord server first; Circle guild only after sign-off |

### Why order matters (dependencies)

Think of it as building a house:

- **T1 backpack** = the filing cabinet drawers. Without it, Brief has nowhere to store “this strat belongs to Saturday.”
- **T2 match details** = labels on the folder (map, opponent, side). Brief and Discord embeds need those.
- **T3 Match Brief** = the desk where you open the folder. Needs T1+T2.
- **T5 attach UI** = buttons to put papers in the drawer. Needs Brief.
- **T0 Discord path** = who is allowed in the building and how we text them. Auth/RSVP/notifications need this before production trust.
- **T4 wizard** = receptionist that creates the folder + papers. Needs backpack + details + (for “new event” ping) notifications.
- **T6/T7 RSVP** = headcount. Needs backpack + (for real members) Discord sync; hub card needs Brief.
- **T12 Discord calendar bot** = last mile; needs Brief links and membership already safe on the **test** server.

**Hard rule:** Bot and member sync are proven on a **separate test Discord server** before Circle production.

---

## How RallyPoint-style parts map to Tactika

| RallyPoint-style idea (#23) | In Tactika | Step |
|-----------------------------|------------|------|
| One screen for the match | **Match Brief** | T3 |
| Guided match create | **Wizard** | T4 |
| Attach strats / prep | Event backpack + attach UI | T1, T5 |
| RSVP bar | RSVP on Brief + hub card | T6, T7 |
| Reminders / new match pings | Notification service + Discord | T0e, T12a |
| Discord calendar / create | Bot slash + two-way sync | T12b |
| Team record / form | KPIs + history | T8, T10 |
| Roster templates | Management roster | T11 |
| Replace Apollobot + Sheets roster | Live Discord roster sync in Tactika | T0d |

---

## Steps (plain explanation → prompt → verify)

### T1 — Event backpack (data hooks) ✅ DONE

**In plain English:**  
Every calendar event gets a backpack that can hold IDs of strats, route plans, whiteboards, and one roster. No fancy screen yet — just the database and API so other steps can attach tools safely.

**Where:** Behind the scenes on **Calendar events** (API).

**Depends on:** nothing.

**One-go prompt:** (already shipped on `agentx/t1-event-hub`) — see tech plan T1 if re-running.

**Verify (all must pass):**
- [x] `npm run db:migrate:local` applies `0014_event_components`
- [x] `npx vite build` succeeds
- [x] Create event → `components` empty object
- [x] `GET /api/events/:id` returns components
- [x] Attach fake strat → 404
- [x] Attach real strat → appears in `stratIds`
- [x] Detach → removed
- [x] Month list still includes `components`

---

### T0a — Test Discord bot (read members)

**In plain English:**  
Install a bot on a **private test Discord server** (not Circle). Prove it can list who is in the server and what Discord roles they have. No login changes yet.

**Where:** Bot process / `discord-bot` (not the main website UI).

**Depends on:** nothing (can parallel T2).

**One-go prompt:**

```
You are implementing Agentx task T0a for closed-release Discord membership (issues #23/#33). Peer playbook: docs/agentx/plans/closed-release-peer-playbook.md

GOAL: Discord bot that can list guild members and their Discord roles on a dedicated TEST Discord server (not Circle production). No auth cutover. Document separate env profiles: test vs prod guild.

WRITE ONLY: discord-bot/ or server/discord/**, package scripts, .env.example for DISCORD_BOT_TOKEN, DISCORD_GUILD_ID (test), DISCORD_APP_ID. Document how to run against test server only.

SELF-CHECK:
- [ ] Dry-run prints member count + sample roles from test guild (redact tokens)
- [ ] README states: do not point default config at Circle prod until security sign-off
- [ ] Fails clearly if token/guild missing
- [ ] Shared-config: tell user before adding any production secrets
Stop for PR. Do not merge unless asked. Plan T0a.
```

**Verify:**
- [ ] Bot starts against **test** guild only
- [ ] Dry-run lists members + roles (no secrets in logs)
- [ ] Docs say “test first, Circle later”
- [ ] Missing token fails clearly

---

### T2 — Match details on the event

**In plain English:**  
When you create/edit a calendar event, you can save match facts: opponent, map, side/faction, optional result. Practice events can leave these blank.

**Where:** Calendar → create/edit event form.

**Depends on:** T1.

**One-go prompt:**

```
You are implementing Agentx task T2 (depends on T1 merged). Issues #23/#33. Peer playbook: docs/agentx/plans/closed-release-peer-playbook.md

GOAL: Extend events with match metadata: opponent, mapId, faction/side, startingPoint optional, result optional — stored on event. Update EventForm for editors.

WRITE ONLY: events store/API sanitize, EventForm.jsx / DayDetails display, calendar-utils if needed. Do not build wizard or Brief.

SELF-CHECK:
- [ ] Create/edit event with map+faction+opponent; reload persists
- [ ] Events without match metadata still work (practice/other)
- [ ] npx vite build
- [ ] Auth unchanged (editor+ write)
Stop for PR. Plan T2.
```

**Verify:**
- [ ] Create scrim with map + opponent + faction → reload still shows them
- [ ] Create “practice/other” with no match fields → still works
- [ ] Viewer cannot edit; editor can
- [ ] `npx vite build` passes

---

### T0b — Discord role → Tactika role map

**In plain English:**  
Write a translation table: “Discord role Comp Admin” means Tactika `admin`, etc. Wrong mapping = wrong powers later — use **test server role IDs**.

**Where:** Config / small admin doc (not full UI required).

**Depends on:** T0a.

**One-go prompt:**

```
You are implementing Agentx task T0b (needs T0a). Peer playbook: docs/agentx/plans/closed-release-peer-playbook.md

GOAL: Configurable mapping Discord role IDs → Tactika roles (owner|admin|assist|editor|viewer). Highest Discord role wins. Unmapped members: deny access (recommended) unless config says viewer. Use test guild role IDs in fixtures; document that Circle prod needs a separate map.

WRITE ONLY: functions/lib/discord-role-map.js (+ optional D1 settings or env JSON DISCORD_ROLE_MAP). Admin readme for mapping Discord roles. Do not change login UI yet.

SELF-CHECK:
- [ ] Unit/fixture: given role ID set → expected Tactika role
- [ ] Document example map for Comp Member / Advisor / Assist / Admin (test guild)
- [ ] Note: prod guild role IDs must be remapped at promote time
Stop for PR. Plan T0b.
```

**Verify:**
- [ ] Fixture: known Discord roles → correct Tactika roles
- [ ] Unmapped user policy documented
- [ ] Note that Circle prod needs a **new** map (don’t copy test IDs)

---

### T0c — Member sync + Steam ↔ Discord link

**In plain English:**  
People still **log in with Steam**. They **link Discord** once. Tactika copies Circle Discord membership into its user list and sets their power from the role map. Leave the Discord server → access should drop (per policy).

**Where:** Account/settings link flow + background sync.

**Depends on:** T0b.

**One-go prompt:**

```
You are implementing Agentx task T0c (needs T0b). CRITICAL: authorization depends on this. Peer playbook: docs/agentx/plans/closed-release-peer-playbook.md

GOAL: Sync Discord guild members into D1 users with discord_id + mapped role. Steam remains login (Q2A). Add Steam↔Discord account linking. After link, Discord-mapped role drives permissions; env OWNER_* remains emergency bootstrap only. Document unlinked policy.

WRITE ONLY: migration for discord_id, users-store sync, sync job/API (admin-only), link endpoints/UI under team/settings, auth path updates. Do not rewrite roster tables (T0d).

SELF-CHECK:
- [ ] Sync upserts members by discord_id
- [ ] Steam user can link Discord; role updates after sync
- [ ] Leaving guild revokes or marks inactive per policy
- [ ] Unlinked behavior matches documented policy
- [ ] npx vite build; migrate local
- [ ] STOP before removing env allowlists in production
Stop for PR. Plan T0c.
```

**Verify (on test guild):**
- [ ] Sync creates/updates users from Discord
- [ ] Steam account can link Discord; role matches map
- [ ] Leave guild → access revoked/inactive as documented
- [ ] Unlinked Steam behavior matches the written policy
- [ ] `npx vite build` + local migrate OK

---

### T0d — Roster from Discord (replace Apollobot)

**In plain English:**  
Match lineups live in Tactika Management, filled from Discord. Optional one-time Apollobot import, then Discord wins. No running both forever.

**Where:** Management → Roster (“Sync from Discord”).

**Depends on:** T0c.

**One-go prompt:**

```
You are implementing Agentx task T0d (needs T0c). Peer playbook: docs/agentx/plans/closed-release-peer-playbook.md

GOAL: Live sync from Discord is roster source of truth (Q3B). Optional one-shot Apollobot CSV/JSON import. Ongoing Management “Sync from Discord”. Document Apollobot retirement — no dual-run.

WRITE ONLY: roster store/import script, Management roster sync action, migrations if needed. Do not build Match Brief.

SELF-CHECK:
- [ ] Discord sync creates/updates roster_members
- [ ] Optional Apollobot import does not fight live sync
- [ ] Ops doc: cut over from Apollobot
- [ ] npx vite build
Stop for PR. Plan T0d.
```

**Verify:**
- [ ] Sync updates roster names/discord ids from test guild
- [ ] Cutover doc exists (Apollobot → Tactika)
- [ ] `npx vite build` passes

---

### T0e — Notification messages

**In plain English:**  
A shared “megaphone”: new event available, event in X minutes, need more signups, need fills. Posts to Discord test channel/DMs without spamming duplicates.

**Where:** Behind the scenes; used by wizard, reminders, RSVP later.

**Depends on:** T0a, T0c.

**One-go prompt:**

```
You are implementing Agentx task T0e (needs T0a+T0c). Peer playbook: docs/agentx/plans/closed-release-peer-playbook.md

GOAL: Notification helpers: (1) new event available (2) event in X minutes (3) additional signup required (4) fill needed. Discord channel and/or DM. Templates + idempotency keys. Admin “test notify” endpoint.

WRITE ONLY: functions/lib/notifications.js (+ discord send helpers), optional notification_log table, test endpoint.

SELF-CHECK:
- [ ] Test endpoint posts to staging/test channel
- [ ] Duplicate send with same idempotency key no-ops
- [ ] Missing bot fails soft with log
Stop for PR. Plan T0e.
```

**Verify:**
- [ ] Admin test notify appears in **test** Discord channel
- [ ] Sending the same notify twice doesn’t double-post
- [ ] Bot offline → soft fail, no crash

---

### T3 — Match Brief page

**In plain English:**  
One webpage for a single match night: title, time, map/opponent/side, and links to strat / routes / whiteboard / roster. Empty states if nothing linked yet. No RSVP yet.

**Where:** `/events/:id` (or similar); link from Calendar.

**Depends on:** T1, T2.

**One-go prompt:**

```
You are implementing Agentx task T3 (needs T1+T2). Peer playbook: docs/agentx/plans/closed-release-peer-playbook.md

GOAL: Match Brief page that loads event by id and shows title, time, match metadata, linked components (deep links), roster summary if set. Empty states when nothing linked.

WRITE ONLY: src/features/events/**, router.jsx, Calendar/Hub “Open brief” one-liner if needed. No RSVP or wizard yet.

SELF-CHECK:
- [ ] /events/:id works authenticated
- [ ] Broken component IDs show “missing” not crash
- [ ] npx vite build
- [ ] Viewer can open read-only
Stop for PR. Plan T3.
```

**Verify:**
- [ ] Open Brief for an event with a linked strat → link works
- [ ] Event with no links → friendly empty state
- [ ] Broken/deleted strat id → “missing”, no crash
- [ ] Viewer can open; editor can open
- [ ] `npx vite build` passes

---

### T5 — Attach / detach on Brief

**In plain English:**  
Buttons on Match Brief to connect or remove an existing strat, route plan, whiteboard, or roster.

**Where:** Match Brief page.

**Depends on:** T1, T3.

**One-go prompt:**

```
You are implementing Agentx task T5 (needs T1+T3). Peer playbook: docs/agentx/plans/closed-release-peer-playbook.md

GOAL: On Match Brief, UI to attach/detach existing strat, route plan, whiteboard, roster. Keep reverse routePlan.eventId in sync when attaching route plans.

WRITE ONLY: EventComponentsPanel + Brief wiring; minimal routeplanner sync if needed.

SELF-CHECK:
- [ ] Attach/detach each type; Brief list updates
- [ ] Route plan eventId matches when attached
- [ ] npx vite build
Stop for PR. Plan T5.
```

**Verify:**
- [ ] Attach strat/route/board/roster from Brief → list updates
- [ ] Detach removes them
- [ ] Attached route plan shows this event when opened in Routeplanner
- [ ] `npx vite build` passes

---

### T4 — Create-match wizard

**In plain English:**  
5 short steps: opponent+date → map → side → create/pick strat → review. Creates the calendar event, fills match details, puts the strat in the backpack, pings “new event” if notifications exist.

**Where:** Calendar / Hub entry point.

**Depends on:** T1, T2, T0e.

**One-go prompt:**

```
You are implementing Agentx task T4 (needs T1+T2+T0e; Brief T3 preferred). Peer playbook: docs/agentx/plans/closed-release-peer-playbook.md

GOAL: Wizard (1) opponent+date (2) map (3) faction (4) create or pick strat (5) review → creates event + components.stratIds + aligned strat match_json. On success call “new event available” notification.

WRITE ONLY: MatchWizard* + Calendar/Hub entry; thin notifications hook.

SELF-CHECK:
- [ ] Wizard creates event on calendar
- [ ] Strat in components and opens in Stratmaker
- [ ] Notification fired or soft-failed with log
- [ ] Cancel leaves no junk (or documented cleanup)
- [ ] npx vite build
Stop for PR. Plan T4.
```

**Verify:**
- [ ] Finish wizard → event on calendar with map/opponent/side
- [ ] Strat linked and opens
- [ ] Test Discord gets “new event” (or soft-fail logged)
- [ ] Cancel mid-wizard doesn’t leave broken half-events (or cleanup documented)
- [ ] `npx vite build` passes

---

### T6 — RSVP

**In plain English:**  
Players mark confirmed / tentative / declined / unavailable on the Match Brief. Counts update.

**Where:** Match Brief RSVP bar.

**Depends on:** T1, T0c.

**One-go prompt:**

```
You are implementing Agentx task T6 (needs T1; T0c for real members). Peer playbook: docs/agentx/plans/closed-release-peer-playbook.md

GOAL: D1 rsvps table; API for self status; RSVP bar on Match Brief. No Hub hero yet (T7).

WRITE ONLY: migration, rsvps-store, events/.../rsvps API, Brief RSVP UI.

SELF-CHECK:
- [ ] Member can change own RSVP
- [ ] Counts correct; unique per (event, steam)
- [ ] npx vite build + migrate local
Stop for PR. Plan T6.
```

**Verify:**
- [ ] Change own RSVP → count updates
- [ ] Can’t create two RSVPs for same person/event
- [ ] `npx vite build` + migrate local OK

---

### T7 — Hub next-match card

**In plain English:**  
Home dashboard shows the next match: countdown, RSVP progress, quick I’m in / Can’t, button to Match Brief.

**Where:** Hub **Home**.

**Depends on:** T3, T6.

**One-go prompt:**

```
You are implementing Agentx task T7 (needs T3+T6). Peer playbook: docs/agentx/plans/closed-release-peer-playbook.md

GOAL: Hub HomePage next match hero: countdown, RSVP progress, I’m in / Can’t, link to Match Brief.

WRITE ONLY: HomePage.jsx, useDashboardQuery.js, small home components. Do not redesign tools grid.

SELF-CHECK:
- [ ] Upcoming event: card shows; RSVP works
- [ ] No upcoming: graceful empty
- [ ] npx vite build
Stop for PR. Plan T7.
```

**Verify:**
- [ ] With upcoming event → card + countdown + Brief link
- [ ] RSVP from card updates counts
- [ ] No upcoming → empty state, no crash
- [ ] `npx vite build` passes

---

### T9 — Prep tasks

**In plain English:**  
Admins assign small prep checklist items to players for a match; players tick them done.

**Where:** Match Brief + “My tasks” on Home.

**Depends on:** T1, T3.

**One-go prompt:**

```
You are implementing Agentx task T9 (needs T1+T3). Peer playbook: docs/agentx/plans/closed-release-peer-playbook.md

GOAL: prep_tasks table; editor assigns; assignees complete; show on Brief + Hub my-tasks.

WRITE ONLY: migration, store, API, Brief checklist, small Hub widget.

SELF-CHECK:
- [ ] Assign/complete permissions correct
- [ ] npx vite build
Stop for PR. Plan T9.
```

**Verify:**
- [ ] Editor assigns task → assignee sees it
- [ ] Assignee can complete; others can’t assign (unless editor+)
- [ ] `npx vite build` passes

---

### T8 — Match history

**In plain English:**  
A list of past matches with results you can browse (HLL Records / history).

**Where:** Records / Management history (+ hub tile if placeholder exists).

**Depends on:** T2.

**One-go prompt:**

```
You are implementing Agentx task T8 (needs T2). Peer playbook: docs/agentx/plans/closed-release-peer-playbook.md

GOAL: List past events with result; open Brief or thin report. Prefer events+components over new tables unless needed.

WRITE ONLY: src/features/records/** or management History + hub tile if needed.

SELF-CHECK:
- [ ] Past matches list; filter by map/opponent if easy
- [ ] npx vite build
Stop for PR. Plan T8.
```

**Verify:**
- [ ] Past events with result appear
- [ ] Can open into Brief / detail
- [ ] `npx vite build` passes

---

### T10 — Team KPIs / charts

**In plain English:**  
Simple win% / form on Home and charts in Management Analytics.

**Where:** Home + Management → Analytics.

**Depends on:** T2.

**One-go prompt:**

```
You are implementing Agentx task T10 (needs T2). Peer playbook: docs/agentx/plans/closed-release-peer-playbook.md

GOAL: Aggregate win/loss; KPI strip on Hub; charts on Management Analytics. Call out lockfile if new chart lib.

WRITE ONLY: aggregation helper, HomePage KPI, AnalyticsSection.jsx.

SELF-CHECK:
- [ ] Empty data safe
- [ ] npx vite build
- [ ] Call out lockfile if new dep
Stop for PR. Plan T10.
```

**Verify:**
- [ ] Empty season → no crash
- [ ] With results → KPIs/charts sensible
- [ ] `npx vite build` passes

---

### T11 — Roster templates

**In plain English:**  
Duplicate a roster / mark templates (e.g. attack lineup). Optional attendance stats if RSVP exists.

**Where:** Management → Roster.

**Depends on:** T0d (T6 optional for attendance %).

**One-go prompt:**

```
You are implementing Agentx task T11. Peer playbook: docs/agentx/plans/closed-release-peer-playbook.md

GOAL: Duplicate roster + template flag; optional attendance from RSVPs. Do not modify events-store.

WRITE ONLY: roster store/API + RosterSection UI.

SELF-CHECK:
- [ ] Duplicate creates new roster with memberships copied
- [ ] npx vite build
Stop for PR. Plan T11.
```

**Verify:**
- [ ] Duplicate roster copies members
- [ ] `npx vite build` passes

---

### T12a — Discord posts + reminders

**In plain English:**  
When a match is created (or “Post to Discord”), announce it. Automatic “match in 24h / 1h” on the test channel.

**Where:** Calendar/Brief button + scheduled job.

**Depends on:** T2, T0e.

**One-go prompt:**

```
You are implementing Agentx task T12a (needs T2+T0e). Peer playbook: docs/agentx/plans/closed-release-peer-playbook.md

GOAL: Post on create / Post-to-Discord button; cron 24h and 1h reminders via T0e. Soft-fail if bot missing. STOP and tell user if wrangler cron config changes.

WRITE ONLY: discord/notification hooks, event create hook, cron if required.

SELF-CHECK:
- [ ] Dry-run no throw when unset
- [ ] Reminder uses idempotency
- [ ] npx vite build
Stop for PR. Plan T12a.
```

**Verify:**
- [ ] Post-to-Discord on test channel works
- [ ] Reminder path doesn’t spam duplicates
- [ ] No bot → soft fail
- [ ] `npx vite build` passes

---

### T12b — Discord slash + two-way calendar

**In plain English:**  
In the **test** Discord: `/calendar` shows upcoming Tactika events; `/event create` makes a Tactika event. Updates can flow both ways. Only mapped roles get power.

**Where:** Discord test server + Calendar “Post to Discord”.

**Depends on:** T12a, T0a–T0c, T1–T3.

**One-go prompt:**

```
You are implementing Agentx task T12b (needs T12a + T0a–T0c + T1–T3). Closed release requires this (Q1B). Peer playbook: docs/agentx/plans/closed-release-peer-playbook.md

GOAL: Slash /event create and /calendar; two-way sync; Post-to-Discord; reuse T0e/T12a. STOP before production secrets. Test guild only until Gate C.

SELF-CHECK:
- [ ] /calendar and /event create work in test guild for mapped roles only
- [ ] Unmapped user cannot escalate via slash
- [ ] Sync works; invalid signature rejected
- [ ] npx vite build; bot dry-run without token does not crash
Stop for PR. Human QA in Discord required. Plan T12b.
```

**Verify (human on test Discord):**
- [ ] `/calendar` shows real Tactika events + Brief links
- [ ] `/event create` → event appears in Tactika calendar
- [ ] Unmapped Discord user cannot create privileged stuff
- [ ] Tactika → Discord post/sync works
- [ ] `npx vite build` passes

---

### Gate C — Promote to Circle Discord

**In plain English:**  
Only after test-server sign-off: new bot token/guild ID, **new** role map (Circle role IDs ≠ test IDs), re-run member/roster/notify/slash QA on Circle.

**Verify:**
- [ ] Separate prod env documented
- [ ] Role map rebuilt for Circle roles
- [ ] Sync + Brief links + slash QA on Circle
- [ ] Apollobot retired for weekly ops

---

## Working agreement for peers

- Branch per step: `agentx/t2-match-metadata`, `agentx/t0a-discord-bot`, …
- PR title starts with step id: `T2: …`
- PR links this playbook + issue #33
- Do not merge if **Verify** boxes aren’t checked in the PR description
- Discord secrets: **test guild only** until Gate C
