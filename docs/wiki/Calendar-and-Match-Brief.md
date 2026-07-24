# Calendar & Match Brief

**Goal:** schedule matches and run prep from one event screen.

## Calendar

Open **Calendar** from the hub.

- **Month view** of scrims, comps, practices, and other events.
- Editors+ can create/edit events with opponent, map, faction, **team** (Circle / Circle Jr), result, HeLO/CRCON links.
- Past events or events with a recorded win/loss may **auto-lock** (edits limited).

### Create an event (Advisor+)

1. Open Calendar → create event.
2. Fill match metadata (map, faction, team, opponent).
3. Save — the event appears on the hub when it’s upcoming.

## Match Brief

Open an event from Calendar or hub → **Match Brief** (`/events/:id`).

| Block | Purpose |
|-------|---------|
| **Match facts** | Opponent, map, faction, Circle / Circle Jr, notes |
| **Linked tools** | Strat, route plan, whiteboard, roster, **LineUp** chips + deep links |
| **Prep tasks** | Assignments; assignees check them off |
| **RSVP** | I’m in / Raincheck |
| **You played** | Shown when your Steam ID is on our side of imported history |

### LineUp size

When creating/editing an event, set **LineUp size** (49 / 36 / 18). This is separate from **Signup target (seats)** (RSVP capacity). See [LineUp](LineUp).

### Attach prep (Advisor+)

1. On Match Brief, use attach controls for strat / route / whiteboard / roster.
2. Comp Admin/Owner can **Create LineUp** (uses the event LineUp size).
3. Or link the event from inside Stratmaker, Routeplanner, or Micro Prep side panels.
4. Detach when the link is wrong — the tool itself is not deleted.

![Match Brief layout](placeholder)

*Match Brief: facts, linked-tool chips, prep tasks, and RSVP in one place.*

### Prep tasks

1. Editors assign tasks to players.
2. Assignees complete checkboxes on the Brief.
3. Open items also show under hub **My tasks**.

### Locking

- Events can lock automatically (past / result recorded) or manually.
- Lock propagates to linked tools; unlock requires sufficient role.
- Individual tools also have their own lock in-editor.

## Related

- [Stratmaker](Stratmaker) · [Routeplanner](Routeplanner) · [Micro Prep](Micro-Prep)
- [Records & HeLO](Records-and-HeLO)
