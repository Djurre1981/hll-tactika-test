import fs from "node:fs";
import path from "node:path";

const html = await fetch("https://stratsketch.com/j6MEtiZLh4o").then((r) => r.text());
const appChunk = html.match(/pages\/_app-[^"]+\.js/)?.[0];
const code = await fetch(`https://stratsketch.com/_next/static/chunks/${appChunk}`).then((r) => r.text());

const icons = new Map();

function addIcon(id, { name, width, height, path, prefix = "fas" }) {
  if (!Number.isFinite(id) || !path) return;
  icons.set(id, { name, width, height, path, prefix, scale: 1 / 40 });
}

// Standard FA: icon:[w,h,[],"hex","path"] or icon:[w,h,[aliases],"hex","path"]
const simpleRe = /iconName:"([^"]+)"[^}]*?icon:\[(\d+),(\d+),(?:\[[^\]]*\],)?"([0-9a-f]+)","([^"]+)"/g;
let m;
while ((m = simpleRe.exec(code)) !== null) {
  addIcon(parseInt(m[4], 16), {
    name: m[1],
    width: Number(m[2]),
    height: Number(m[3]),
    path: m[5],
  });
}

// Duotone FA: icon:[w,h,[],"hex",["path1","path2"]]
const duoRe = /prefix:"fad",iconName:"([^"]+)",icon:\[(\d+),(\d+),\[\],"([0-9a-f]+)",\["([^"]+)"(?:,"([^"]+)")?\]\]/g;
while ((m = duoRe.exec(code)) !== null) {
  const primary = m[5];
  const secondary = m[6];
  const path = secondary ? `${primary} ${secondary}` : primary;
  addIcon(parseInt(m[4], 16), {
    name: m[1],
    width: Number(m[2]),
    height: Number(m[3]),
    path,
    prefix: "fad",
  });
}

// Named exports: e114:()=>w with inline icon - catch iconName near prefix fad without export name
const inlineDuoRe = /prefix:"fad",iconName:"([^"]+)",icon:\[(\d+),(\d+),\[\],"([0-9a-f]+)",\[([\s\S]*?)\]\]/g;
while ((m = inlineDuoRe.exec(code)) !== null) {
  const paths = [...m[5].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  if (!paths.length) continue;
  addIcon(parseInt(m[4], 16), {
    name: m[1],
    width: Number(m[2]),
    height: Number(m[3]),
    path: paths.join(" "),
    prefix: "fad",
  });
}

const out = Object.fromEntries([...icons.entries()].sort((a, b) => a[0] - b[0]));
const outPath = path.join("js", "strats", "stratsketch-icon-pack.js");
fs.writeFileSync(outPath, `export default ${JSON.stringify(out)};\n`);
fs.writeFileSync(path.join("js", "strats", "stratsketch-icon-pack.json"), JSON.stringify(out));
console.log("wrote", Object.keys(out).length, "icons to", outPath);

const wanted = [58702, 57620, 62550, 63580, 57621, 62622, 62948];
for (const id of wanted) {
  console.log(id, out[id] ? `${out[id].prefix}:${out[id].name}` : "MISSING");
}
