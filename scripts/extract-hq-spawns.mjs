/**
 * Extract HQ command spawns + transport truck positions from MLL data.js.
 * Output: public/data/hq-spawns.json
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE = path.join(ROOT, "tmp-maps-let-loose", "data.js");
const OUT = path.join(ROOT, "public", "data", "hq-spawns.json");
const MAP_SIZE = 1920;

/** MLL faction a = left-side spawns (US on Carentan), b = right-side (GER). */
const FACTION_META = {
  a: { id: "us", label: "US", hqSide: "left" },
  b: { id: "ger", label: "GER", hqSide: "right" },
};

function pct(px) {
  return Math.round((px / MAP_SIZE) * 10000) / 100;
}

function extractBlock(text, name) {
  const marker = `const ${name} =`;
  const start = text.indexOf(marker);
  if (start < 0) throw new Error(`Missing ${name}`);
  let i = text.indexOf("{", start);
  let depth = 0;
  for (; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return text.slice(start + marker.length, i + 1).trim();
    }
  }
  throw new Error(`Could not parse ${name}`);
}

function jsToJson(js) {
  let out = js.replace(/\/\/.*$/gm, "");
  out = out.replace(/angle:\s*90\s*\+\s*(-?\d+(?:\.\d+)?)/g, (_, n) => `"angle": ${90 + Number(n)}`);
  out = out.replace(/,(\s*[}\]])/g, "$1");
  out = out.replace(/([\{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":');
  out = out.replace(/'/g, '"');
  return out;
}

function toPoint(entry) {
  if (!entry || typeof entry.left !== "number" || typeof entry.top !== "number") return null;
  return {
    x: pct(entry.left),
    y: pct(entry.top),
    angle: typeof entry.angle === "number" ? entry.angle : null,
  };
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Missing ${SOURCE}`);
    process.exit(1);
  }

  const text = fs.readFileSync(SOURCE, "utf8");
  const raw = JSON.parse(jsToJson(extractBlock(text, "DEFAULT_ELEMENTS")));

  const maps = {};
  for (const [mapId, mapData] of Object.entries(raw)) {
    const factions = {};
    for (const [factionKey, meta] of Object.entries(FACTION_META)) {
      const commandSpawns = (mapData.command_spawn?.[factionKey] || [])
        .map(toPoint)
        .filter(Boolean);
      const transportTrucks = (mapData.truck?.[factionKey] || [])
        .filter((t) => t.modifier === "transport")
        .map(toPoint)
        .filter(Boolean);

      factions[meta.id] = {
        ...meta,
        commandSpawns,
        transportTrucks,
        /** Route start = HQ command spawn; fall back to transport truck if missing. */
        hqSpawns: commandSpawns.length ? commandSpawns : transportTrucks,
      };
    }
    maps[mapId] = { mapId, factions };
  }

  fs.writeFileSync(
    OUT,
    JSON.stringify(
      {
        mapSize: MAP_SIZE,
        metersPerMapPct: 10,
        maps,
      },
      null,
      2
    )
  );
  console.log(`Wrote ${OUT} (${Object.keys(maps).length} maps)`);
}

main();
