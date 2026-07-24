# LineUp

**Goal:** assign RSVP’d players into sector-colored squads for a match.

## Where

1. Set **LineUp size** on the calendar event: **49** (ECL), **36**, or **18**.
2. Open **Match Brief** → Linked tools → **Create LineUp** (Comp Admin / Owner).
3. Open the LineUp board from the chip (`/lineups/:id`).

## Board

- **Command:** Commander, Artillery (DAP squad), Streamer (size 36/49).
- **Sectors:** North/West (red), Meat Grind (green), South/East (blue), Defence (orange), Flex (black), Recon (grey), Tanks (light blue). A sector can contain **multiple squads**.
- **Reserves:** confirmed players not in a playing slot (no-show replacements).
- **Nodes:** task overlay (N/Mid/S HQ — Engineer + 3 Support each + SL for nodes). Does **not** add roster slots; assignees must already be on infantry.

## Presence

Checkboxes mark **show / no-show** (briefing attendance). Manual in v1; Discord voice sync comes later.

## Rules (blocked on save)

- Playing slots = LineUp size
- ≤ 20 squads (Commander / Streamer do not count; Arty / tanks / recon / infantry do)
- Infantry ≤6, armor ≤3, recon ≤2; ≤3 armor squads, ≤2 recon
- Only **RSVP confirmed** players; Admin **Force RSVP** backdoor on the board
- Nodes assignees must already sit on an infantry squad

## Lock

Admin can **lock / unlock**. LineUp also **auto-locks after match end time**.

## Permissions

| Role | View | Edit / create / lock / force RSVP |
|------|------|-----------------------------------|
| Comp Member+ | Yes | No |
| Comp Admin / Owner | Yes | Yes |

## Related

- [Calendar & Match Brief](Calendar-and-Match-Brief)
- [Roles & permissions](Roles-and-Permissions)
