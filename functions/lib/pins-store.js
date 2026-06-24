import seedPins from "../../data/pins.json";

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

export async function loadPinsData(env) {
  if (env.PINS_KV) {
    const stored = await env.PINS_KV.get(KV_KEY, "json");
    if (stored?.pins) {
      return stored;
    }

    const initial = cloneSeedPins();
    await env.PINS_KV.put(KV_KEY, JSON.stringify(initial));
    return initial;
  }

  if (!memoryStore) {
    memoryStore = cloneSeedPins();
  }
  return memoryStore;
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
