import seedPins from "../../public/data/pins.json";
import { getDb, requireDb } from "./d1.js";
import { normalizePinTitle } from "./pin-title.js";

const DEFAULT_MAP_ID = seedPins.defaultMapId || "SMDMV2";

let memoryStore = null;

function cloneSeedPins() {
  const data = structuredClone(seedPins);
  for (const mapId of Object.keys(data.pins || {})) {
    data.pins[mapId] = (data.pins[mapId] || []).map((pin) => ({
      ...pin,
      createdBy: pin.createdBy ?? null,
    }));
  }
  return data;
}

function migratePinTitles(data) {
  for (const mapPins of Object.values(data.pins || {})) {
    for (const pin of mapPins) {
      pin.title = normalizePinTitle(pin.title);
    }
  }
}

function parseJson(raw, fallback) {
  if (raw == null || raw === "") {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function jsonOrNull(value) {
  if (value == null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

export function rowToPin(row) {
  const pin = {
    id: String(row.id),
    title: String(row.title || ""),
    description: row.description != null ? String(row.description) : "",
    tag: String(row.tag || "climb"),
    faction: String(row.faction || "neutral"),
    x: Number(row.x),
    y: Number(row.y),
    videoUrl: row.video_url ? String(row.video_url) : "",
    createdBy: row.created_by != null ? String(row.created_by) : null,
    createdByName: row.created_by_name ? String(row.created_by_name) : null,
  };

  if (row.thumbnail) {
    pin.thumbnail = String(row.thumbnail);
  }
  if (row.dir_x != null && Number.isFinite(Number(row.dir_x))) {
    pin.dirX = Number(row.dir_x);
  }
  if (row.dir_y != null && Number.isFinite(Number(row.dir_y))) {
    pin.dirY = Number(row.dir_y);
  }

  const requires = parseJson(row.requires_json, null);
  if (requires && typeof requires === "object") {
    pin.requires = requires;
  }

  const mediaItems = parseJson(row.media_items_json, null);
  if (Array.isArray(mediaItems)) {
    pin.mediaItems = mediaItems;
  }

  if (row.source_discord_message_id) {
    pin.sourceDiscordMessageId = String(row.source_discord_message_id);
  }

  return pin;
}

function bindUpsert(db, mapId, pin) {
  const title = normalizePinTitle(pin.title);
  return db
    .prepare(
      `INSERT INTO pins (
         id, map_id, title, description, tag, faction, x, y, dir_x, dir_y,
         video_url, thumbnail, requires_json, media_items_json,
         created_by, created_by_name, source_discord_message_id,
         created_at, updated_at
       ) VALUES (
         ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?,
         ?, ?, ?,
         COALESCE(?, datetime('now')), datetime('now')
       )
       ON CONFLICT(id) DO UPDATE SET
         map_id = excluded.map_id,
         title = excluded.title,
         description = excluded.description,
         tag = excluded.tag,
         faction = excluded.faction,
         x = excluded.x,
         y = excluded.y,
         dir_x = excluded.dir_x,
         dir_y = excluded.dir_y,
         video_url = excluded.video_url,
         thumbnail = excluded.thumbnail,
         requires_json = excluded.requires_json,
         media_items_json = excluded.media_items_json,
         created_by = COALESCE(excluded.created_by, pins.created_by),
         created_by_name = COALESCE(excluded.created_by_name, pins.created_by_name),
         source_discord_message_id = excluded.source_discord_message_id,
         updated_at = datetime('now')`
    )
    .bind(
      String(pin.id),
      String(mapId),
      title,
      pin.description != null ? String(pin.description) : null,
      String(pin.tag || "climb"),
      String(pin.faction || "neutral"),
      Number(pin.x),
      Number(pin.y),
      Number.isFinite(Number(pin.dirX)) ? Number(pin.dirX) : null,
      Number.isFinite(Number(pin.dirY)) ? Number(pin.dirY) : null,
      pin.videoUrl ? String(pin.videoUrl) : null,
      pin.thumbnail ? String(pin.thumbnail) : null,
      pin.requires ? jsonOrNull(pin.requires) : null,
      Array.isArray(pin.mediaItems) ? jsonOrNull(pin.mediaItems) : null,
      pin.createdBy != null ? String(pin.createdBy) : null,
      pin.createdByName ? String(pin.createdByName) : null,
      pin.sourceDiscordMessageId ? String(pin.sourceDiscordMessageId) : null,
      pin.createdAt || null
    );
}

export async function loadPinsData(env) {
  if (getDb(env)) {
    const db = requireDb(env);
    const result = await db.prepare("SELECT * FROM pins").all();
    const pins = {};
    for (const row of result.results || []) {
      const mapId = String(row.map_id);
      if (!pins[mapId]) {
        pins[mapId] = [];
      }
      const pin = rowToPin(row);
      pin.title = normalizePinTitle(pin.title);
      pins[mapId].push(pin);
    }
    return { defaultMapId: DEFAULT_MAP_ID, pins };
  }

  if (!memoryStore) {
    memoryStore = cloneSeedPins();
  }
  migratePinTitles(memoryStore);
  return memoryStore;
}

export async function upsertPin(env, mapId, pin) {
  if (getDb(env)) {
    const db = requireDb(env);
    await bindUpsert(db, mapId, pin).run();
    return;
  }

  const data = await loadPinsData(env);
  if (!data.pins[mapId]) {
    data.pins[mapId] = [];
  }
  const index = data.pins[mapId].findIndex((entry) => entry.id === pin.id);
  const next = { ...pin, title: normalizePinTitle(pin.title) };
  if (index >= 0) {
    data.pins[mapId][index] = next;
  } else {
    data.pins[mapId].push(next);
  }
  memoryStore = data;
}

export async function upsertPins(env, mapId, pins) {
  if (!pins?.length) {
    return;
  }

  if (getDb(env)) {
    const db = requireDb(env);
    await db.batch(pins.map((pin) => bindUpsert(db, mapId, pin)));
    return;
  }

  for (const pin of pins) {
    await upsertPin(env, mapId, pin);
  }
}

export async function deletePin(env, pinId) {
  const id = String(pinId || "").trim();
  if (!id) {
    return;
  }

  if (getDb(env)) {
    const db = requireDb(env);
    await db.prepare("DELETE FROM pins WHERE id = ?").bind(id).run();
    return;
  }

  const data = await loadPinsData(env);
  for (const mapId of Object.keys(data.pins || {})) {
    data.pins[mapId] = (data.pins[mapId] || []).filter((pin) => pin.id !== id);
  }
  memoryStore = data;
}

/** @deprecated Prefer upsertPin / deletePin for multi-writer safety. */
export async function savePinsData(env, data) {
  if (getDb(env)) {
    const db = requireDb(env);
    const existing = await db.prepare("SELECT id FROM pins").all();
    const desired = new Set();
    const statements = [];

    for (const [mapId, mapPins] of Object.entries(data.pins || {})) {
      for (const pin of mapPins || []) {
        if (!pin?.id) continue;
        desired.add(String(pin.id));
        statements.push(bindUpsert(db, mapId, pin));
      }
    }

    for (const row of existing.results || []) {
      if (!desired.has(String(row.id))) {
        statements.push(db.prepare("DELETE FROM pins WHERE id = ?").bind(row.id));
      }
    }

    if (statements.length > 0) {
      await db.batch(statements);
    }
    return;
  }

  memoryStore = data;
}

export function findPin(data, mapId, pinId) {
  const pins = data.pins?.[mapId] || [];
  const index = pins.findIndex((pin) => pin.id === pinId);
  if (index < 0) {
    return null;
  }
  return { pin: pins[index], index, pins };
}
