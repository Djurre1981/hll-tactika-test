/**
 * Morphological ops on pathfinding grids.
 */

/** Expand blocked cells by `radius` (Chebyshev / square kernel — matches extract-accessibility). */
export function dilateBlocked(blocked, gridSize, radius) {
  if (radius <= 0) return blocked;
  const out = new Uint8Array(blocked.length);
  for (let gy = 0; gy < gridSize; gy += 1) {
    for (let gx = 0; gx < gridSize; gx += 1) {
      if (!blocked[gy * gridSize + gx]) continue;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const nx = gx + dx;
          const ny = gy + dy;
          if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
          out[ny * gridSize + nx] = 1;
        }
      }
    }
  }
  return out;
}
