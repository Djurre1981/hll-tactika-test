# Plan: Strat icon animation review (#7)

## Goal
Audit Strat icons and add selective motion for a few high-signal markers used in competitive Hell Let Loose match planning — without animating the full palette.

## Agreed decisions (from lead gate)
- UI / framework: existing map-kernel canvas animation loop (ping path)
- Data storage: no schema/API change — draw-time allowlist only
- Auth (if any): n/a
- Blind-spot defaults included: most icons stay static; HLL PNGs stay static
- Explicitly skipped for later: HLL object animation, toolbar SVG previews, denser markers (flags, letter circles)

## Isolation lane
local

## Assumptions
- Ping remains the primary ephemeral callout; animated icons mark persistent threat/focus semantics.
- Motion reuses ping timing (`PING_PERIOD_MS` / ease-out) so the map stays readable.

## Tasks

| ID | Task | Writes (ownership) | Depends on | Verify |
|----|------|--------------------|------------|--------|
| T1 | Allowlist + `objectNeedsAnimation` for selected icon ids | `map-kernel/icons/animated-icon-ids.js`, `map-kernel/object-schema.js` | — | `node scripts/verify-strat-render.mjs` |
| T2 | Draw rings / opacity / scale in `drawIcon` | `map-kernel/CanvasRenderer.js` | T1 | visual on Strats + verify script |

## Integration
Single agent on branch `agentx/strat-icon-animation-review`.

## Done when
- [x] `crosshairs`, `triangle-exclamation`, `skull-crossbones`, `bomb` animate; others do not
- [x] `scripts/verify-strat-render.mjs` passes
- [x] Vite build succeeds for touched area

## Risks
- Too many animated icons on dense slides → keep allowlist tiny
- Competing with real pings → crosshairs rings are smaller/softer than ping
