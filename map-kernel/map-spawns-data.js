/** Load map spawn / strongpoint grid data (maps-let-loose). */

let mapSpawnsCache = null;
let mapSpawnsPromise = null;

export async function loadMapSpawnsData() {
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

export function getStrongpointGridFromSpawns(mapSpawns, mapId) {
  if (!mapId || !mapSpawns?.maps) return null;
  return mapSpawns.maps.find((m) => m.id === mapId)?.strongpointGrid || null;
}
