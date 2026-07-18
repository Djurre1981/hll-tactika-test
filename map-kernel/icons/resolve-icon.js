/**
 * Resolve StratSketch / built-in icon path data for canvas Path2D + SVG previews.
 * Pack keyed by StratSketch numeric id; builtins keyed by string iconId.
 */
import iconPack from "./stratsketch-icon-pack.js";

export const SS_LEGACY_ICON_MAX = 19;

/**
 * Solid paths for icons StratSketch does not ship (or extractor missed).
 * Prefer pack entries when present.
 */
const EXTRA_BUILTIN_PATHS = {
  "magnifying-glass": {
    name: "magnifying-glass",
    width: 512,
    height: 512,
    path: "M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z",
    layers: [
      "M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z",
    ],
    prefix: "fas",
  },
};

function normalizeEntry(entry, packId) {
  if (!entry?.name) return null;
  const layers = (
    Array.isArray(entry.layers) && entry.layers.length
      ? entry.layers
      : entry.path
        ? [entry.path]
        : []
  )
    .map((d) => String(d || "").trim())
    .filter(Boolean);
  if (!layers.length) return null;
  return {
    name: entry.name,
    width: entry.width || 512,
    height: entry.height || 512,
    path: layers.join(" "),
    layers,
    prefix: entry.prefix || "fas",
    packId,
  };
}

const packById = iconPack && typeof iconPack === "object" ? iconPack : {};
const packByName = Object.create(null);

for (const [id, entry] of Object.entries(packById)) {
  const normalized = normalizeEntry(entry, Number(id) || id);
  if (!normalized) continue;
  if (!packByName[normalized.name]) {
    packByName[normalized.name] = normalized;
  }
}

for (const [name, entry] of Object.entries(EXTRA_BUILTIN_PATHS)) {
  if (!packByName[name]) {
    packByName[name] = normalizeEntry(entry, name);
  }
}

/** Fallback check mark when nothing resolves. */
const CHECK_FALLBACK = packByName.check || packByName["magnifying-glass"];

export function isStratSketchPackIconId(iconId) {
  const id = Number(iconId);
  return Number.isFinite(id) && id > SS_LEGACY_ICON_MAX;
}

export function getStratSketchIconSync(iconId) {
  const id = Number(iconId);
  if (!Number.isFinite(id)) return null;
  const raw = packById[String(id)] || packById[id] || null;
  return raw ? normalizeEntry(raw, id) : null;
}

export function getBuiltinIconByName(iconId) {
  if (!iconId || typeof iconId !== "string") return null;
  return packByName[iconId] || null;
}

/**
 * @param {{ iconId?: string, ssIconId?: number }} meta
 * @returns {{ name: string, width: number, height: number, path: string, layers: string[] } | null}
 */
export function resolveIconDef(meta = {}) {
  if (isStratSketchPackIconId(meta.ssIconId)) {
    const fromPack = getStratSketchIconSync(meta.ssIconId);
    if (fromPack?.path) return fromPack;
  }

  const byName = getBuiltinIconByName(meta.iconId);
  if (byName?.path) return byName;

  return getBuiltinIconByName("check") || CHECK_FALLBACK;
}
