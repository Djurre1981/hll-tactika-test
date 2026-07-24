# Calendar & Match Brief

**Goal:** schedule matches and run prep from one event screen.

## Calendar

Open **Calendar** from the hub.

- **Month view** of scrims, comps, practices, and other events.
- **Upcoming events** panel lists what’s next (replaces the old day schedule strip).
- Editors+ can create/edit events with opponent, map, faction, **team** (Circle / Circle Jr), result, HeLO/CRCON links.
- Past events or events with a recorded win/loss may **auto-lock** (edits limited).

### Create an event (Advisor+)

1. Open Calendar → create event.
2. Fill match metadata (map, faction, team, opponent).
3. Optionally enable **Limit RSVP signups** and set **Max In signups** (off by default).
4. Set **LineUp size** (49 / 36 / 18) when you plan to use the board.
5. Configure the **Event prep** checklist (types enabled, primary + helpers) — defaults depend on event type.
6. Save — the event appears on the hub when it’s upcoming.

## Match Brief

Open an event from Calendar or hub → **Match Brief** (`/events/:id`).

| Block | Purpose |
|-------|---------|
| **Match facts** | Opponent, map, faction, Circle / Circle Jr, notes |
| **Linked tools** | Strat, route plan, whiteboard, roster, **LineUp** chips + deep links |
| **Event prep** | Structured checklist (9 types); assignees mark done |
| **RSVP** | **In** / **Maybe** / **Out** while open; raincheck after close |
| **You played** | Shown when your Steam ID is on our side of imported history |

### RSVP (In / Maybe / Out)

While RSVP is **open**, pick your attendance:

| Button | Meaning |
|--------|---------|
| **In** | Confirmed for the match |
| **Maybe** | Reserve / tentative (FIFO queue when signup cap is full) |
| **Out** | Not attending (no reason required while open) |

**Signup cap** (optional on the event): when **Max In signups** is set, extra **In** responses move to **Maybe** automatically. When someone drops from **In**, the next **Maybe** is promoted in queue order.

**RSVP closes** when staff click **Close RSVP** on the brief, or when the linked **LineUp** is effectively locked. After close:

- Most players see their final status only.
- Players who were **In** can still submit a **Raincheck** (reason required).
- **Out** while open is not the same as raincheck — raincheck is for late drops after close.

Event **lock** (past match / result recorded) does **not** block RSVP changes — only RSVP close and LineUp lock do.

Staff see attendance pulse on **Management → Overview**.

### RSVP seats vs LineUp size

| Field | Meaning |
|-------|---------|
| **Max In signups** | Optional cap on confirmed **In** count; overflow → **Maybe** |
| **LineUp size** | Playing slots on the LineUp board (**49** / **36** / **18**) |

See [LineUp](LineUp) for the board.

### Event prep checklist

Editors configure a fixed checklist on the **event form** and **Match Brief**:

| Type | Auto progress when… |
|------|---------------------|
| General / Tank / Defense / MG strat | A linked strat has matching **Event prep role** |
| Routes | A route plan is attached to the event |
| LineUps | A LineUp is attached |
| Snipes, Commander prep, Other | Primary assignee is set |

**Defaults by event type:** comp = all types; scrim = General, Tank, Routes, LineUps; practice/other = General only.

Each enabled row has a **primary** and up to **two helpers** (from the comp roster). Status: **Not started** → **In progress** (auto or when work begins) → **Done** (manual checkbox).

**My tasks** on the hub lists open prep rows assigned to you (structured slots + any legacy free-text tasks).

### Attach prep (Advisor+)

1. On Match Brief, use attach controls for strat / route / whiteboard / roster.
2. Comp Admin/Owner can **Create LineUp** (uses the event LineUp size), then open the board chip.
3. Or link the event from inside Stratmaker, Routeplanner, or Micro Prep side panels.
4. Detach when the link is wrong — the tool itself is not deleted.

![Match Brief layout](placeholder)

*Match Brief: facts, linked-tool chips, event prep, and RSVP in one place.*

### Locking

- Events can lock automatically (past / result recorded) or manually.
- Lock propagates to linked tools; unlock requires sufficient role.
- Individual tools also have their own lock in-editor.
- **Close RSVP** is separate from event lock.

## Related

- [Stratmaker](Stratmaker) · [Routeplanner](Routeplanner) · [Micro Prep](Micro-Prep) · [LineUp](LineUp)
- [Records & HeLO](Records-and-HeLO)
