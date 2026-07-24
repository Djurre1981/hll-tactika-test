# LineUp

**Goal:** assign RSVP’d players into sector-colored squads for a match.

## Where

1. Set **LineUp size** on the calendar event: **49** (ECL), **36**, or **18**.  
   This is separate from **RSVP seats** (signup capacity / waitlist).
2. Open **Match Brief** → Linked tools → **Create LineUp** (Comp Admin / Owner).
3. Open the LineUp board from the chip (`/lineups/:id`).

## Board layout

Default boards start **sparse** (one squad per infantry / recon sector; Tank 1–3 for 36/49). Use **+** on a sector header to add another empty squad.

| Area | Contents |
|------|----------|
| Header | Title, **players X/size** and **squads X/20** counters, Streamers pulldown, Force RSVP, Reset layout, Lock |
| Command / Artillery | Commander + Artillery (DAP) |
| Tanks | Tank 1–3 as separate cards (36/49) |
| Infantry / recon sectors | North/West, Meat Grind, South/East, Defence, Flex, Recon |
| Sidebar | **RSVP pool** (top) and **Reserves** (bottom) |

**Streamers (external):** Axis / Allies name + stream URL in the header pulldown (left of Force RSVP). Not playing slots.

**Nodes:** Support / Engineer on infantry auto-fill the nodes overlay. Each assignee can show **SL for nodes** from their squad’s SL. Nodes do not add roster slots.

## Assigning

1. Drag **confirmed** RSVPs from the pool onto role slots (or reserves).
2. Pool **role filters** (infantry / tanks / MG / squad lead) narrow the list using Comp Roster roles — click again to clear.
3. Pool / reserve badges show lifetime **confirmed RSVPs / times benched** (`12r / 3b`) for fair rotation.
4. When playing slots hit LineUp size, remaining confirmed players **auto-fill reserves**. If players and squads are both full, use **Fill reserves**.
5. Full player count blocks dragging more from the pool; full squad count hides sector **+**.

## Fairness tracking

On **Lock** (or auto-lock after match end), Tactika snapshots who confirmed, who played, and who sat reserve. Lifetime totals power the `Nr / Nb` badges.

## Presence

Manual **show / no-show** checkboxes on placed players (briefing attendance). Discord Briefing bot is planned later.

## Rules (blocked on save)

- Playing slots ≤ LineUp size (streamers excluded)
- ≤ 20 squads (Commander does not count; Arty / tanks / recon / infantry do)
- Infantry ≤6, armor ≤3, recon ≤2; ≤3 armor squads, ≤2 recon
- Only **RSVP confirmed** players; Admin **Force RSVP** backdoor
- Nodes assignees must already sit on an infantry squad

## Reset layout

**Reset layout** rebuilds the default sparse board for the event’s LineUp size (clears assignments). Use after size changes or when an old dense layout needs refreshing.

## Lock

Admin can **lock / unlock**. LineUp also **auto-locks after match end time**.

## Permissions

| Role | View | Edit / create / lock / force RSVP / reset |
|------|------|-------------------------------------------|
| Comp Member+ | Yes | No |
| Comp Admin / Owner | Yes | Yes |

## Related

- [Calendar & Match Brief](Calendar-and-Match-Brief)
- [Roles & permissions](Roles-and-Permissions)
