/**
 * Build mono obstacle mask from accessibility overlay PNG pixels.
 */
import sharp from "sharp";

export const ALPHA_THRESHOLD = 40;
export const COLOR_TOLERANCE = 45;
export const BLUE_HATCH_ALPHA_MIN = 1;
export const OBSTACLE_FILL_COLORS = [
  { id: "red", r: 255, g: 0, b: 0 },
  { id: "orange", r: 255, g: 127, b: 0 },
  { id: "green", r: 0, g: 255, b: 0 },
  { id: "blue", r: 0, g: 0, b: 255 },
  { id: "yellow", r: 255, g: 255, b: 0 },
];
export const BLUE_HATCH_DILATE_PX = 3;
export const BLUE_WALL_DILATE_PX = 1;

function matchesObstacleFill(r, g, b, a) {
  if (a < ALPHA_THRESHOLD) return false;
  return OBSTACLE_FILL_COLORS.some(
    (c) =>
      Math.abs(r - c.r) <= COLOR_TOLERANCE &&
      Math.abs(g - c.g) <= COLOR_TOLERANCE &&
      Math.abs(b - c.b) <= COLOR_TOLERANCE
  );
}

function matchesBlueOutline(r, g, b, a) {
  if (a < ALPHA_THRESHOLD) return false;
  const blue = OBSTACLE_FILL_COLORS.find((c) => c.id === "blue");
  return (
    Math.abs(r - blue.r) <= COLOR_TOLERANCE &&
    Math.abs(g - blue.g) <= COLOR_TOLERANCE &&
    Math.abs(b - blue.b) <= COLOR_TOLERANCE
  );
}

function matchesBluePixel(r, g, b, a) {
  if (a < BLUE_HATCH_ALPHA_MIN) return false;
  const blue = OBSTACLE_FILL_COLORS.find((c) => c.id === "blue");
  return (
    Math.abs(r - blue.r) <= COLOR_TOLERANCE &&
    Math.abs(g - blue.g) <= COLOR_TOLERANCE &&
    Math.abs(b - blue.b) <= COLOR_TOLERANCE
  );
}

function floodExterior(mask, wall, width, height) {
  const exterior = new Uint8Array(mask.length);
  const queue = [];

  for (let x = 0; x < width; x++) {
    queue.push(x, (height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    queue.push(y * width, y * width + width - 1);
  }

  while (queue.length) {
    const i = queue.pop();
    if (exterior[i] || wall[i]) continue;
    exterior[i] = 1;
    const x = i % width;
    const y = (i / width) | 0;
    if (x > 0) queue.push(i - 1);
    if (x < width - 1) queue.push(i + 1);
    if (y > 0) queue.push(i - width);
    if (y < height - 1) queue.push(i + width);
  }

  return exterior;
}

function dilateMask(mask, width, height, radius) {
  if (radius <= 0) return mask;
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!mask[i]) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          out[ny * width + nx] = 1;
        }
      }
    }
  }
  return out;
}

export function buildObstacleMask(data, width, height) {
  const blocked = new Uint8Array(width * height);
  const blueAny = new Uint8Array(width * height);
  const blueWall = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const a = data[o + 3];

    if (matchesObstacleFill(r, g, b, a)) blocked[i] = 1;
    if (matchesBluePixel(r, g, b, a)) blueAny[i] = 1;
    if (matchesBlueOutline(r, g, b, a)) blueWall[i] = 1;
  }

  if (blueAny.some((v) => v === 1)) {
    const blueSolid = dilateMask(blueAny, width, height, BLUE_HATCH_DILATE_PX);
    for (let i = 0; i < width * height; i++) {
      if (blueSolid[i]) blocked[i] = 1;
    }
  }

  if (blueWall.some((v) => v === 1)) {
    const wall =
      BLUE_WALL_DILATE_PX > 0
        ? dilateMask(blueWall, width, height, BLUE_WALL_DILATE_PX)
        : blueWall;
    const exterior = floodExterior(blocked, wall, width, height);

    for (let i = 0; i < width * height; i++) {
      if (!wall[i] && !exterior[i]) blocked[i] = 1;
    }
  }

  return blocked;
}

export function buildMonoRgba(blocked, width, height) {
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const isBlocked = blocked[i] === 1;
    out[o] = isBlocked ? 0 : 255;
    out[o + 1] = isBlocked ? 0 : 255;
    out[o + 2] = isBlocked ? 0 : 255;
    out[o + 3] = 255;
  }
  return out;
}

export async function loadAccessibilityMono(pngPath) {
  const { data, info } = await sharp(pngPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const blocked = buildObstacleMask(data, info.width, info.height);
  const monoRaw = buildMonoRgba(blocked, info.width, info.height);
  return {
    blocked,
    monoRaw,
    width: info.width,
    height: info.height,
    imageData: { width: info.width, height: info.height, data: new Uint8ClampedArray(monoRaw) },
  };
}
