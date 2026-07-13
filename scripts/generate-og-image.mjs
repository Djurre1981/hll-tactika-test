import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const width = 1200;
const height = 630;
const bg = "#0f1012";
const title = "HLL-Tactika";
const paragraph =
  "Tactika is The Circle's strategy platform for hell let loose. The project is developed by the community and kept strictly exclusive to its competitive team.";

const fontHeavy = readFileSync(path.join(root, "assets/fonts/Texta-Heavy.ttf")).toString("base64");
const fontBook = readFileSync(path.join(root, "assets/fonts/TextaAlt-Book.ttf")).toString("base64");

function wrapText(text, maxChars) {
  const words = text.split(" ");
  const lines = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const textLines = wrapText(paragraph, 38);
const lineHeight = 38;
const paragraphStartY = 150;
const tspans = textLines
  .map((line, index) => {
    const dy = index === 0 ? 0 : lineHeight;
    return `<tspan x="0" dy="${dy}">${escapeXml(line)}</tspan>`;
  })
  .join("");

const textSvg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="620" height="500" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @font-face {
        font-family: "Texta";
        src: url("data:font/truetype;charset=utf-8;base64,${fontHeavy}") format("truetype");
        font-weight: 800;
      }
      @font-face {
        font-family: "TextaAlt";
        src: url("data:font/truetype;charset=utf-8;base64,${fontBook}") format("truetype");
        font-weight: 400;
      }
    </style>
  </defs>
  <text y="58" font-family="Texta" font-size="58" font-weight="800" fill="#ffffff">${escapeXml(title)}</text>
  <text y="${paragraphStartY}" font-family="TextaAlt" font-size="28" fill="#c5c9d0">${tspans}</text>
</svg>`);

const logoPath = path.join(root, "assets/logos/pixellogo.png");
const logoMeta = await sharp(logoPath).metadata();
const logoTargetH = 500;
const logoTargetW = Math.round((logoMeta.width / logoMeta.height) * logoTargetH);
const logoLeft = width - 80 - logoTargetW;
const logoTop = Math.round((height - logoTargetH) / 2);

const resizedLogo = await sharp(logoPath).resize(logoTargetW, logoTargetH, { fit: "inside" }).png().toBuffer();

await sharp({
  create: {
    width,
    height,
    channels: 4,
    background: bg,
  },
})
  .composite([
    { input: textSvg, left: 72, top: 72 },
    { input: resizedLogo, left: logoLeft, top: logoTop },
  ])
  .png()
  .toFile(path.join(root, "assets/og-image.png"));

console.log("Wrote assets/og-image.png");

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
