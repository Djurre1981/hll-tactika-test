/**
 * Hell Let Loose placeables (Maps Let Loose asset sizes on a 1920×1920 tacmap).
 * sizePct = (nativePx * customScale) / 1920 * 100
 * Spawn markers default to radius art at scale 1; plain uses MLL customScale when set.
 * Assets are SVGs (crisp when enlarged). Regenerate from PNGs via `npm run vectorize:hll-objects`.
 */

const MAP_PX = 1920;

function pct(px, scale = 1) {
  return Number(((px * scale) / MAP_PX) * 100).toFixed(4) * 1;
}

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   group: string,
 *   src: string,
 *   sizePct: number,
 *   sizeHPct?: number,
 *   plainSrc?: string,
 *   plainSizePct?: number,
 *   plainSizeHPct?: number,
 *   hasRadius?: boolean,
 * }} HllObjectDef
 */

/** @type {HllObjectDef[]} */
export const HLL_OBJECT_OPTIONS = [
  // Spawns
  {
    id: "garrison",
    label: "Garrison",
    group: "Spawn",
    src: "/assets/hll-objects/garry-blue-zone.svg",
    sizePct: pct(380),
    plainSrc: "/assets/hll-objects/garry-plain.svg",
    plainSizePct: pct(51),
    hasRadius: true,
  },
  {
    id: "airhead",
    label: "Airhead",
    group: "Spawn",
    src: "/assets/hll-objects/airhead-radius.svg",
    sizePct: pct(122),
    plainSrc: "/assets/hll-objects/airhead-plain.svg",
    plainSizePct: pct(64, 0.5),
    hasRadius: true,
  },
  {
    id: "halftrack",
    label: "Halftrack",
    group: "Spawn",
    src: "/assets/hll-objects/halftrack-radius.svg",
    sizePct: pct(122),
    plainSrc: "/assets/hll-objects/halftrack-plain.svg",
    plainSizePct: pct(51, 0.5),
    hasRadius: true,
  },
  {
    id: "outpost",
    label: "Outpost",
    group: "Spawn",
    src: "/assets/hll-objects/outpost-normal-radius.svg",
    sizePct: pct(122),
    plainSrc: "/assets/hll-objects/outpost-normal-plain.svg",
    plainSizePct: pct(64, 0.5),
    hasRadius: true,
  },
  {
    id: "recon-outpost",
    label: "Recon Outpost",
    group: "Spawn",
    src: "/assets/hll-objects/outpost-recon-radius.svg",
    sizePct: pct(122),
    plainSrc: "/assets/hll-objects/outpost-recon-plain.svg",
    plainSizePct: pct(64, 0.5),
    hasRadius: true,
  },
  {
    id: "forward",
    label: "Forward Position",
    group: "Spawn",
    src: "/assets/hll-objects/forward-radius.svg",
    sizePct: pct(261),
    plainSrc: "/assets/hll-objects/forward-plain.svg",
    plainSizePct: pct(51),
    hasRadius: true,
  },

  // Vehicles
  { id: "tank-heavy", label: "Heavy Tank", group: "Vehicle", src: "/assets/hll-objects/tank-heavy.svg", sizePct: pct(51, 0.5) },
  { id: "tank-medium", label: "Medium Tank", group: "Vehicle", src: "/assets/hll-objects/tank-med.svg", sizePct: pct(51, 0.5) },
  { id: "tank-light", label: "Light Tank", group: "Vehicle", src: "/assets/hll-objects/tank-light.svg", sizePct: pct(51, 0.5) },
  { id: "tank-recon", label: "Recon Tank", group: "Vehicle", src: "/assets/hll-objects/tank-recon.svg", sizePct: pct(51, 0.5) },
  { id: "jeep", label: "Jeep", group: "Vehicle", src: "/assets/hll-objects/truck-jeep.svg", sizePct: pct(51, 0.5) },
  { id: "truck-supply", label: "Supply Truck", group: "Vehicle", src: "/assets/hll-objects/truck-supply.svg", sizePct: pct(51, 0.5) },
  { id: "truck-transport", label: "Transport Truck", group: "Vehicle", src: "/assets/hll-objects/truck-transport.svg", sizePct: pct(51, 0.5) },

  // Classes
  { id: "class-commander", label: "Commander", group: "Class", src: "/assets/hll-objects/class-commander.svg", sizePct: pct(51, 0.3) },
  { id: "class-officer", label: "Officer", group: "Class", src: "/assets/hll-objects/class-officer.svg", sizePct: pct(51, 0.3) },
  { id: "class-rifleman", label: "Rifleman", group: "Class", src: "/assets/hll-objects/class-rifleman.svg", sizePct: pct(51, 0.3) },
  { id: "class-assault", label: "Assault", group: "Class", src: "/assets/hll-objects/class-assault.svg", sizePct: pct(51, 0.3) },
  { id: "class-auto-rifleman", label: "Automatic Rifleman", group: "Class", src: "/assets/hll-objects/class-auto-rifleman.svg", sizePct: pct(51, 0.3) },
  { id: "class-medic", label: "Medic", group: "Class", src: "/assets/hll-objects/class-medic.svg", sizePct: pct(51, 0.3) },
  { id: "class-support", label: "Support", group: "Class", src: "/assets/hll-objects/class-support.svg", sizePct: pct(51, 0.3) },
  { id: "class-machine-gunner", label: "Machine Gunner", group: "Class", src: "/assets/hll-objects/class-machine-gunner.svg", sizePct: pct(51, 0.3) },
  { id: "class-anti-tank", label: "Anti-Tank", group: "Class", src: "/assets/hll-objects/class-anti-tank.svg", sizePct: pct(51, 0.3) },
  { id: "class-engineer", label: "Engineer", group: "Class", src: "/assets/hll-objects/class-engineer.svg", sizePct: pct(51, 0.3) },
  { id: "class-spotter", label: "Spotter", group: "Class", src: "/assets/hll-objects/class-spotter.svg", sizePct: pct(51, 0.3) },
  { id: "class-sniper", label: "Sniper", group: "Class", src: "/assets/hll-objects/class-sniper.svg", sizePct: pct(51, 0.3) },

  // Buildables
  { id: "at-gun", label: "AT Gun", group: "Buildable", src: "/assets/hll-objects/at-gun-plain.svg", sizePct: pct(51, 0.5) },
  { id: "repair-station", label: "Repair Station", group: "Buildable", src: "/assets/hll-objects/repair-station.svg", sizePct: pct(36, 0.35) },
  { id: "node-batch", label: "Batch of Nodes", group: "Buildable", src: "/assets/hll-objects/node-batch.svg", sizePct: pct(122) },
  { id: "node-manpower", label: "Manpower Node", group: "Buildable", src: "/assets/hll-objects/node-manpower.svg", sizePct: pct(122) },
  { id: "node-munition", label: "Munitions Node", group: "Buildable", src: "/assets/hll-objects/node-munition.svg", sizePct: pct(122) },
  { id: "node-fuel", label: "Fuel Node", group: "Buildable", src: "/assets/hll-objects/node-fuel.svg", sizePct: pct(122) },

  // Placeables
  { id: "supplies-50", label: "Supplies (50)", group: "Placeable", src: "/assets/hll-objects/supplies-50.svg", sizePct: pct(51) },
  { id: "supplies-50x2", label: "Supplies (50×2)", group: "Placeable", src: "/assets/hll-objects/supplies-50x2.svg", sizePct: pct(51) },
  { id: "supplies-100", label: "Supplies (100)", group: "Placeable", src: "/assets/hll-objects/supplies-100.svg", sizePct: pct(51) },
  { id: "supplies-150", label: "Supplies (150)", group: "Placeable", src: "/assets/hll-objects/supplies-150.svg", sizePct: pct(51) },
  { id: "supplies-150x2", label: "Supplies (150×2)", group: "Placeable", src: "/assets/hll-objects/supplies-150x2.svg", sizePct: pct(51) },
  { id: "box-ammo", label: "Ammo Box", group: "Placeable", src: "/assets/hll-objects/box-ammo.svg", sizePct: pct(31) },
  { id: "box-explosive", label: "Explosive Box", group: "Placeable", src: "/assets/hll-objects/box-explosive.svg", sizePct: pct(31) },
  { id: "box-bandage", label: "Bandage Box", group: "Placeable", src: "/assets/hll-objects/box-bandage.svg", sizePct: pct(31) },
  { id: "mine-at", label: "AT Mine", group: "Placeable", src: "/assets/hll-objects/mine-at.svg", sizePct: pct(31) },
  { id: "mine-ap", label: "AP Mine", group: "Placeable", src: "/assets/hll-objects/mine-ap.svg", sizePct: pct(31) },

  // Markers
  { id: "arty-effect", label: "Artillery AOE", group: "Marker", src: "/assets/hll-objects/arty-effect.svg", sizePct: pct(67) },
  { id: "enemy-garrison", label: "Enemy Garrison", group: "Marker", src: "/assets/hll-objects/enemy-garry.svg", sizePct: pct(51) },
  { id: "enemy-infantry", label: "Enemy Infantry", group: "Marker", src: "/assets/hll-objects/enemy-infantry.svg", sizePct: pct(51) },
  { id: "enemy-outpost", label: "Enemy Outpost", group: "Marker", src: "/assets/hll-objects/enemy-op.svg", sizePct: pct(51) },
  { id: "enemy-tank", label: "Enemy Tank", group: "Marker", src: "/assets/hll-objects/enemy-tank.svg", sizePct: pct(51) },
  { id: "enemy-vehicle", label: "Enemy Light Vehicle", group: "Marker", src: "/assets/hll-objects/enemy-vehicle.svg", sizePct: pct(51) },

  // Command abilities
  { id: "supply-drop", label: "Supply Drop", group: "Ability", src: "/assets/hll-objects/supply-drop.svg", sizePct: pct(51, 0.5) },
  { id: "ammo-drop", label: "Ammo Drop", group: "Ability", src: "/assets/hll-objects/ammo-drop.svg", sizePct: pct(51, 0.5) },
  { id: "airhead-drop", label: "Airhead Drop", group: "Ability", src: "/assets/hll-objects/airhead-drop.svg", sizePct: pct(51, 0.5) },
  { id: "reinforce", label: "Reinforce", group: "Ability", src: "/assets/hll-objects/reinforce.svg", sizePct: pct(51, 0.5) },
  {
    id: "strafing-run",
    label: "Strafing Run",
    group: "Ability",
    src: "/assets/hll-objects/strafing-run.svg",
    sizePct: pct(380),
    sizeHPct: pct(51),
  },
  {
    id: "bombing-run",
    label: "Bombing Run",
    group: "Ability",
    src: "/assets/hll-objects/bombing-run.svg",
    sizePct: pct(189),
    sizeHPct: pct(51),
  },
  {
    id: "katyusha-strike",
    label: "Katyusha Strike",
    group: "Ability",
    src: "/assets/hll-objects/katyusha-strike.svg",
    sizePct: pct(197),
  },
];

export const HLL_OBJECT_IDS = HLL_OBJECT_OPTIONS.map((o) => o.id);

const byId = Object.fromEntries(HLL_OBJECT_OPTIONS.map((o) => [o.id, o]));

export function getHllObjectDef(hllId) {
  return byId[hllId] || byId.garrison || null;
}

export function resolveHllAsset(meta = {}, options = {}) {
  const def = getHllObjectDef(meta.hllId);
  if (!def) return null;
  const showRadius =
    options.showRadius !== undefined
      ? Boolean(options.showRadius) && Boolean(def.hasRadius)
      : meta.showRadius !== false && Boolean(def.hasRadius);
  if (showRadius) {
    return {
      def,
      src: def.src,
      sizeWPct: def.sizePct,
      sizeHPct: def.sizeHPct ?? def.sizePct,
    };
  }
  const sizeWPct = def.plainSizePct ?? def.sizePct;
  return {
    def,
    src: def.plainSrc || def.src,
    sizeWPct,
    sizeHPct: def.plainSizeHPct ?? def.sizeHPct ?? sizeWPct,
  };
}

/** Sidebar/toolbar preview — never the radius art. */
export function getHllToolbarPreviewSrc(hllIdOrDef) {
  const def =
    typeof hllIdOrDef === "string" || !hllIdOrDef
      ? getHllObjectDef(hllIdOrDef)
      : hllIdOrDef;
  if (!def) return "";
  return def.plainSrc || def.src;
}

/** Half of the garrison radius art sizePct — in-game exclusion disk. */
export function getGarrisonExclusionRadiusPct() {
  const def = getHllObjectDef("garrison");
  return (def?.sizePct || 0) / 2;
}

/** Center of an HLL object in map-% (bbox midpoint or single point). */
export function hllObjectCenter(object) {
  const pts = object?.points;
  if (!Array.isArray(pts) || pts.length === 0) return null;
  if (pts.length >= 2) {
    return {
      x: (pts[0].x + pts[1].x) / 2,
      y: (pts[0].y + pts[1].y) / 2,
    };
  }
  const p = pts[0];
  return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : null;
}

/**
 * True if `point` is outside every existing friendly garrison's spawn radius.
 * @param {{ x: number, y: number }} point
 * @param {Array} objects
 */
export function isGarrisonPlacementValid(point, objects) {
  const radius = getGarrisonExclusionRadiusPct();
  if (!point || !(radius > 0)) return true;
  const list = Array.isArray(objects) ? objects : [];
  for (const obj of list) {
    if (obj?.type !== "hll" || obj.meta?.hllId !== "garrison") continue;
    const center = hllObjectCenter(obj);
    if (!center) continue;
    if (Math.hypot(point.x - center.x, point.y - center.y) < radius) return false;
  }
  return true;
}
