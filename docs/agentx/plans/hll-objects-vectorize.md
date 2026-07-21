# Plan: Vectorize HLL objects

## Goal
Replace pixelated HLL placeable PNGs with scalable SVGs so enlarged markers stay sharp on competitive strat maps.

## Agreed decisions
- Approach: nearest-neighbor upscale + imagetracer → SVG; black backgrounds cleared to transparent
- Catalog/toolbar/roster point at `.svg`; PNGs kept as regenerate sources
- Isolation: local branch `agentx/hll-objects-vectorize`

## Tasks
| ID | Task | Writes |
|----|------|--------|
| T1 | Vectorize script + generate SVGs | `scripts/vectorize-hll-objects.mjs`, `public/assets/hll-objects/*.svg` |
| T2 | Point catalog + roster at SVG; smooth canvas draw | `hll-object-catalog.js`, `rosterRoles.js`, `CanvasRenderer.js`, README, package.json |

## Done when
- [x] All catalog assets resolve to SVG
- [x] `node scripts/verify-strat-render.mjs` + `npx vite build` pass
