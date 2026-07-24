# LineUp

**Goal:** assign RSVP’d players into sector-colored squads for a match.

## Where

1. Set **LineUp size** on the calendar event: **49** (ECL), **36**, or **18**.
2. Open **Match Brief** → Linked tools → **Create LineUp** (Comp Admin / Owner).
3. Open the LineUp board from the chip (`/lineups/:id`).

## Board

- **Command:** Commander, Artillery (DAP squad).
- **Streamers (external):** Streamer Axis + Streamer Allies + stream URL each (not roster slots; list picker later).
- **Board grid:** (1A–1B) title · (1C) Command · (1D) Artillery · (2B–2D) Tank 1–3 · (3B–3D) North/West · Meat Grind · South/East · (4B–4D) Defence · Flex · Recon. Column A = RSVP pool + reserves.
- **Reserves:** confirmed players not in a playing slot. When playing slots hit LineUp size (49/36/18), remaining confirmed RSVPs are **auto-filled into reserves**.
- **Streamers:** header pulldown (left of Force RSVP) — Axis/Allies name + stream URL.
- **Nodes:** Support/Engineer on infantry auto-fill the nodes overlay. Each assignee shows **SL for nodes** from their squad’s SL.

## Assigning

Drag confirmed players from the RSVP pool onto role slots (or reserves). Pool badges show lifetime **confirmed RSVP count / times benched** (`12r / 3b`) so admins can rotate fairly.

## Fairness tracking

On **Lock** (or auto-lock after match end), Tactika snapshots who confirmed, who played, and who sat reserve. Lifetime totals appear on the pool and reserve list.
## Rules (blocked on save)

- Playing slots ≤ LineUp size (streamers excluded); start sparse and add squads with **+**
- ≤ 20 squads (Commander does not count; Arty / tanks / recon / infantry do)
- Infantry ≤6, armor ≤3, recon ≤2; ≤3 armor squads, ≤2 recon
- Only **RSVP confirmed** players; Admin **Force RSVP** backdoor
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
