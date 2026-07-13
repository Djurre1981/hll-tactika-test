let packPromise;

async function loadIconPack() {
  if (!packPromise) {
    packPromise = import("./stratsketch-icon-pack.js").then((mod) => mod.default || mod);
  }
  return packPromise;
}

export async function getStratSketchIcon(iconId) {
  const id = Number(iconId);
  if (!Number.isFinite(id)) return null;
  const pack = await loadIconPack();
  return pack[String(id)] || pack[id] || null;
}

export function getStratSketchIconSync(iconId, pack) {
  const id = Number(iconId);
  if (!Number.isFinite(id) || !pack) return null;
  return pack[String(id)] || pack[id] || null;
}

/** StratSketch icon ids below this threshold use the legacy 0–19 enum. */
export const SS_LEGACY_ICON_MAX = 19;

export function isStratSketchPackIconId(iconId) {
  const id = Number(iconId);
  return Number.isFinite(id) && id > SS_LEGACY_ICON_MAX;
}
