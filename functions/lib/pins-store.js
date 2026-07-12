import seedPins from "../../data/pins.json";
import { normalizePinTitle } from "./pin-title.js";

const KV_KEY = "pins";

let memoryStore = null;

function cloneSeedPins() {
  const data = structuredClone(seedPins);
  for (const mapId of Object.keys(data.pins)) {
    data.pins[mapId] = data.pins[mapId].map((pin) => ({
      ...pin,
      createdBy: pin.createdBy ?? null,
    }));
  }
  return data;
}

function migratePinTitles(data) {
  let changed = false;
  for (const mapPins of Object.values(data.pins || {})) {
    for (const pin of mapPins) {
      const normalized = normalizePinTitle(pin.title);
      if (pin.title !== normalized) {
        pin.title = normalized;
        changed = true;
      }
    }
  }
  return changed;
}

async function loadAndMigratePinsData(env) {
  let data;
  if (env.PINS_KV) {
    const stored = await env.PINS_KV.get(KV_KEY, "json");
    if (stored?.pins) {
      data = stored;
    } else {
      data = cloneSeedPins();
      await env.PINS_KV.put(KV_KEY, JSON.stringify(data));
    }
  } else {
    if (!memoryStore) {
      memoryStore = cloneSeedPins();
    }
    data = memoryStore;
  }

  if (migratePinTitles(data)) {
    await savePinsData(env, data);
  }
  return data;
}

export async function loadPinsData(env) {
  return loadAndMigratePinsData(env);
}

export async function savePinsData(env, data) {
  if (env.PINS_KV) {
    await env.PINS_KV.put(KV_KEY, JSON.stringify(data));
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
