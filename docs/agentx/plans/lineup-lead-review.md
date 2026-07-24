# Lead review: Match LineUp

## Goal
Build a Match Brief–attached LineUp board so Admins assign RSVP’d players into sector-colored squads (with nodes overlay + reserves), sized by event roster property (49 / 36 / 18).

## Existing stack (if any)
- React hub on Cloudflare Pages + D1 + R2
- Steam sign-in + allowlist roles (`viewer` → `owner`)
- Calendar / Match Brief / RSVP / event `components` hub already exist
- Discord bot + merc role: deferred (post-v1)

## Decisions (from AskQuestion / clicks)

| # | Question | Chosen option | Other text (if any) |
|---|----------|---------------|---------------------|
| 1 | What should v1 ship? | A — LineUp board + event roster size only | Discord bot + merc login later |
| 2 | How should the board start? | A — Fixed default layouts per 49 / 36 / 18, editable | |
| 3 | Who can edit? | A — Comp Admin + Owner only | |
| 4 | Hard-rule violations? | A — Block save; show why | |
| 5 | Who can be placed? | A — RSVP I’m in only | Admin/Owner **force-RSVP** backdoor |
| 6 | Where does LineUp live? | A — Attached on Match Brief | |
| 7 | Lock official roster? | B — Admin lock/unlock | Also **auto-lock after match end time** |
| 8 | Nodes assignees? | A — Must already be on infantry squad; overlay only | |
| 9 | Who can view? | A — All Comp Members+ view; Admin/Owner edit | |
| 10 | v1 extras? | 1, 2, 4 | Live multi-admin editing; manual presence checkboxes (bot-ready); mobile-friendly. Skip audit log for now |

## Blind-spot extras chosen
- Live collab editing
- Manual presence (show/no-show) fields ready for Discord briefing VC later
- Mobile-friendly board
- Skipped / deferred: Discord bot presence, merc auth/scoping, audit log, time-gated merc full-lineup reveal

## Hard rules (agreed product constraints)
- Roster size event property: 49 | 36 | 18
- Max 20 squads/team; Commander does **not** count; arty / recon / tanks **do**
- Squad caps: infantry ≤6, armor ≤3, recon ≤2; ≤3 armor squads, ≤2 recon
- Sector colors: North/West red, Meat Grind green, South/East blue, Defence orange/terracotta, Flex black, Recon grey, Tanks light blue
- Sector blocks can contain **multiple** squads (SL-1/2/3)
- Reserves: signed up, not in playing slots; promote on no-show
- Nodes N/Mid/S: 3 Support + 1 Engineer each; SL-for-nodes; does not add to player count
- Presence checkbox = show/no-show (manual in v1; Briefing VC later)

## Effort & lock-in
- Build size: **medium** (new event component + schema + board UI + validation + lock + live sync)
- Hard to change later: event `components` shape for lineup id; roster-size on events; squad/slot data model; presence field shape (bot will depend on it)

## Status
Lead decisions confirmed — ready to write AgentX plan on OK.
