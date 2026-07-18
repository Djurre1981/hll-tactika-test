import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const html = await fetch("https://stratsketch.com/j6MEtiZLh4o").then((r) => r.text());
const appChunk = html.match(/pages\/_app-[^"]+\.js/)?.[0];
if (!appChunk) throw new Error("Could not find StratSketch _app chunk");
const code = await fetch(`https://stratsketch.com/_next/static/chunks/${appChunk}`).then((r) =>
  r.text()
);

const icons = new Map();

function addIcon(id, { name, width, height, layers, prefix = "fas" }) {
  if (!Number.isFinite(id) || !name) return;
  const clean = (Array.isArray(layers) ? layers : [])
    .map((d) => String(d || "").trim())
    .filter(Boolean);
  if (!clean.length) return;
  const prev = icons.get(id);
  const pathD = clean.join(" ");
  if (prev && (prev.path?.length || 0) >= pathD.length) return;
  icons.set(id, {
    name,
    width,
    height,
    path: pathD,
    layers: clean,
    prefix,
    scale: 1 / 40,
  });
}

let m;

const simpleRe =
  /iconName:"([^"]+)"[^}]*?icon:\[(\d+),(\d+),(?:\[[^\]]*\],)?"([0-9a-f]+)","([^"]+)"/g;
while ((m = simpleRe.exec(code)) !== null) {
  addIcon(parseInt(m[4], 16), {
    name: m[1],
    width: Number(m[2]),
    height: Number(m[3]),
    layers: [m[5]],
  });
}

const duoRe =
  /prefix:"fad",iconName:"([^"]+)",icon:\[(\d+),(\d+),\[[^\]]*\],"([0-9a-f]+)",\[([\s\S]*?)\]\]/g;
while ((m = duoRe.exec(code)) !== null) {
  const layers = [...m[5].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  addIcon(parseInt(m[4], 16), {
    name: m[1],
    width: Number(m[2]),
    height: Number(m[3]),
    layers,
    prefix: "fad",
  });
}

const out = Object.fromEntries([...icons.entries()].sort((a, b) => a[0] - b[0]));
const outJs = path.join(root, "map-kernel", "icons", "stratsketch-icon-pack.js");
fs.writeFileSync(outJs, `export default ${JSON.stringify(out)};\n`);
console.log("wrote", Object.keys(out).length, "icons to", outJs);

const sample = out["57591"];
console.log("circle-a layers", sample?.layers?.length, "pathLen", sample?.path?.length);
