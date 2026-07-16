/**
 * Transform KV JSON blobs into D1 row objects (pins + users only).
 */

const ALLOWED_ROLES = new Set(["viewer", "editor", "assist", "admin", "owner"]);
const ALLOWED_FACTIONS = new Set(["axis", "allies", "neutral"]);

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function jsonOrNull(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function normalizeRole(role) {
  if (role === "user") return "viewer";
  return ALLOWED_ROLES.has(role) ? role : "viewer";
}

function normalizeFaction(faction) {
  return ALLOWED_FACTIONS.has(faction) ? faction : "neutral";
}

export function buildPinRows(pinsData) {
  const rows = [];
  const stamp = nowIso();
  const byMap = pinsData?.pins || {};

  for (const [mapId, pins] of Object.entries(byMap)) {
    if (!Array.isArray(pins)) continue;
    for (const pin of pins) {
      if (!pin || typeof pin !== "object") continue;
      const id = String(pin.id || "").trim();
      const title = String(pin.title || "").trim();
      if (!id || !title) continue;
      if (!Number.isFinite(Number(pin.x)) || !Number.isFinite(Number(pin.y))) continue;

      rows.push({
        id,
        map_id: String(mapId),
        title,
        description: pin.description != null ? String(pin.description) : null,
        tag: String(pin.tag || "climb"),
        faction: normalizeFaction(pin.faction),
        x: Number(pin.x),
        y: Number(pin.y),
        dir_x: Number.isFinite(Number(pin.dirX)) ? Number(pin.dirX) : null,
        dir_y: Number.isFinite(Number(pin.dirY)) ? Number(pin.dirY) : null,
        video_url: pin.videoUrl ? String(pin.videoUrl) : null,
        thumbnail: pin.thumbnail ? String(pin.thumbnail) : null,
        requires_json: pin.requires ? jsonOrNull(pin.requires) : null,
        media_items_json: Array.isArray(pin.mediaItems) ? jsonOrNull(pin.mediaItems) : null,
        created_by: pin.createdBy != null ? String(pin.createdBy) : null,
        created_by_name: pin.createdByName ? String(pin.createdByName) : null,
        created_at: pin.createdAt ? String(pin.createdAt) : stamp,
        updated_at: stamp,
      });
    }
  }

  return rows;
}

export function buildUserRows(usersData) {
  const stamp = nowIso();
  const users = [];
  const seen = new Set();

  for (const user of usersData?.users || []) {
    if (!user || typeof user !== "object") continue;
    const steamId = String(user.steamId || "").trim();
    if (!steamId || seen.has(steamId)) continue;
    seen.add(steamId);

    users.push({
      steam_id: steamId,
      role: normalizeRole(user.role),
      display_name: user.displayName ? String(user.displayName) : null,
      avatar_url: user.avatarUrl ? String(user.avatarUrl) : null,
      preferences_json: user.preferences ? jsonOrNull(user.preferences) : null,
      created_at: user.createdAt ? String(user.createdAt) : stamp,
      updated_at: stamp,
    });
  }

  const revoked = [...new Set(
    (usersData?.revoked || [])
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  )];

  return { users, revoked };
}
