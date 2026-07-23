/** Strongpoint sector grid helpers (maps-let-loose POINT_COORDS parity). */

let mapSpawnsCache = null;
let mapSpawnsPromise = null;

export const STRONGPOINT_GRID_SIZE = 5;

export function sectorKey(row, col) {
  return `${row}${col}`;
}

export function parseSectorKey(key) {
  const raw = String(key ?? "");
  if (raw.length < 2) return null;
  const row = Number(raw.charAt(0));
  const col = Number(raw.charAt(1));
  if (!Number.isFinite(row) || !Number.isFinite(col)) return null;
  return { row, col };
}

export async function loadMapSpawns() {
  if (mapSpawnsCache) return mapSpawnsCache;
  if (mapSpawnsPromise) return mapSpawnsPromise;
  mapSpawnsPromise = fetch("/data/map-spawns.json")
    .then((res) => (res.ok ? res.json() : { maps: [] }))
    .catch(() => ({ maps: [] }))
    .then((data) => {
      mapSpawnsCache = data;
      return data;
    });
  return mapSpawnsPromise;
}

export function getMapEntry(mapSpawns, mapId) {
  if (!mapId || !mapSpawns?.maps) return null;
  return mapSpawns.maps.find((m) => m.id === mapId) || null;
}

export function getStrongpointGrid(mapSpawns, mapId) {
  return getMapEntry(mapSpawns, mapId)?.strongpointGrid || null;
}

/** MLL: west/east HQs when row 0 col 1 exists; north/south when top row is empty. */
export function isWestEastHqLayout(grid) {
  return grid?.[0]?.[1] != null;
}

export function listSectorCells(grid) {
  const cells = [];
  for (let row = 0; row < STRONGPOINT_GRID_SIZE; row++) {
    for (let col = 0; col < STRONGPOINT_GRID_SIZE; col++) {
      const available = grid?.[row]?.[col] != null;
      cells.push({ row, col, key: sectorKey(row, col), available });
    }
  }
  return cells;
}

export function availableSectorKeys(grid) {
  return listSectorCells(grid)
    .filter((cell) => cell.available)
    .map((cell) => cell.key);
}

export function normalizeVisibleStrongpoints(value, grid) {
  const available = availableSectorKeys(grid);
  if (!available.length) return [];
  if (value == null) return [...available];
  if (!Array.isArray(value)) return [...available];
  const allowed = new Set(available);
  return value.map(String).filter((key) => allowed.has(key));
}

export function visibleStrongpointsSummary(value, grid) {
  const available = availableSectorKeys(grid);
  if (!available.length) return "N/A";
  if (value == null) return "All";
  const count = normalizeVisibleStrongpoints(value, grid).length;
  if (count === 0) return "None";
  if (count === available.length) return "All";
  return `${count}/${available.length}`;
}
