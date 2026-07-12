import seedStrats from "../../data/strats.json";

const KV_KEY = "strats";

let memoryStore = null;

function cloneSeedStrats() {
  return structuredClone(seedStrats);
}

export async function loadStratsData(env) {
  if (env.PINS_KV) {
    const stored = await env.PINS_KV.get(KV_KEY, "json");
    if (stored?.strats) {
      return stored;
    }
    const data = cloneSeedStrats();
    await env.PINS_KV.put(KV_KEY, JSON.stringify(data));
    return data;
  }

  if (!memoryStore) {
    memoryStore = cloneSeedStrats();
  }
  return memoryStore;
}

export async function saveStratsData(env, data) {
  if (env.PINS_KV) {
    await env.PINS_KV.put(KV_KEY, JSON.stringify(data));
    return;
  }
  memoryStore = data;
}

export function findStrat(data, stratId) {
  const strats = data.strats || [];
  const index = strats.findIndex((strat) => strat.id === stratId);
  if (index < 0) {
    return null;
  }
  return { strat: strats[index], index, strats };
}
