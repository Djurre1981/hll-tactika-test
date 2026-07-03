const MAP_FADE_PALETTE = [
  { rgb: "62, 36, 15", peak: 0.76, mid: 0.28 },
  { rgb: "60, 75, 76", peak: 0.68, mid: 0.24 },
  { rgb: "76, 76, 60", peak: 0.68, mid: 0.24 },
  { rgb: "87, 86, 80", peak: 0.68, mid: 0.24 },
  { rgb: "66, 33, 33", peak: 0.68, mid: 0.24 },
  { rgb: "60, 66, 48", peak: 0.68, mid: 0.24 },
];

let fadeTone = { s: 0.35, l: 0.15, peak: 0.76, mid: 0.28 };
let currentHue = 28;
let customHue = null;
let hueRandom = true;
let fadeEnabled = true;

function getMapShell() {
  return document.querySelector(".map-shell");
}

function parseRgbString(rgb) {
  return rgb.split(",").map((part) => Number(part.trim()));
}

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
        break;
      case gn:
        h = ((bn - rn) / d + 2) / 6;
        break;
      default:
        h = ((rn - gn) / d + 4) / 6;
        break;
    }
  }

  return [h * 360, s, l];
}

function hslToRgb(h, s, l) {
  const hn = h / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  function hueToChannel(channel) {
    let value = channel;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return p + (q - p) * 6 * value;
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
    return p;
  }

  const r = hueToChannel(hn + 1 / 3);
  const g = hueToChannel(hn);
  const b = hueToChannel(hn - 1 / 3);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function applyFadeVars(shell, rgb, peak, mid) {
  shell.style.setProperty("--map-fade-rgb", rgb);
  shell.style.setProperty("--map-fade-peak", String(peak));
  shell.style.setProperty("--map-fade-mid", String(mid));
}

function applyHueToShell(shell, hue) {
  const [r, g, b] = hslToRgb(hue, fadeTone.s, fadeTone.l);
  applyFadeVars(shell, `${r}, ${g}, ${b}`, fadeTone.peak, fadeTone.mid);
  currentHue = hue;
}

function syncFadeClass(shell) {
  shell.classList.toggle("map-shell--fade-on", fadeEnabled);
}

function applyFromPaletteEntry(entry) {
  const shell = getMapShell();
  if (!shell) return;

  const [r, g, b] = parseRgbString(entry.rgb);
  const [h, s, l] = rgbToHsl(r, g, b);
  fadeTone = { s, l, peak: entry.peak, mid: entry.mid };
  currentHue = h;
  applyFadeVars(shell, entry.rgb, entry.peak, entry.mid);
  syncFadeClass(shell);
}

export function getMapBgHue() {
  return Math.round(currentHue);
}

export function isMapBgFadeEnabled() {
  return fadeEnabled;
}

export function setMapBgFadeEnabled(enabled) {
  fadeEnabled = enabled;
  const shell = getMapShell();
  if (!shell) return;
  syncFadeClass(shell);
}

export function isMapBgHueRandom() {
  return hueRandom;
}

export function setMapBgHueRandom(random) {
  hueRandom = random;
  const shell = getMapShell();
  if (!shell) return;

  if (random) {
    customHue = null;
    applyMapBgFade({ random: true });
    return;
  }

  customHue = ((currentHue % 360) + 360) % 360;
  applyHueToShell(shell, customHue);
  syncFadeClass(shell);
}

export function applyMapBgHue(hue) {
  const shell = getMapShell();
  if (!shell) return;

  const normalizedHue = ((hue % 360) + 360) % 360;
  hueRandom = false;
  customHue = normalizedHue;
  applyHueToShell(shell, normalizedHue);
  syncFadeClass(shell);
}

export function applyMapBgFade({ random = true } = {}) {
  const shell = getMapShell();
  if (!shell) return;

  if (!fadeEnabled) {
    syncFadeClass(shell);
    return;
  }

  if (!hueRandom && customHue != null) {
    applyHueToShell(shell, customHue);
    syncFadeClass(shell);
    return;
  }

  if (random) {
    const entry = MAP_FADE_PALETTE[Math.floor(Math.random() * MAP_FADE_PALETTE.length)];
    applyFromPaletteEntry(entry);
  }

  syncFadeClass(shell);
}

export function restoreMapBgFadeSettings({ enabled = true, hue = null, random = true } = {}) {
  fadeEnabled = enabled;
  hueRandom = random;
  customHue = random ? null : hue;
  applyMapBgFade({ random });
}

export function initMapColorControl({ persistToggles, persistBgHue, persistBgRandom } = {}) {
  const toggle = document.getElementById("toggle-color");
  const hueBtn = document.getElementById("btn-bg-hue");
  const control = document.getElementById("map-color-control");
  const popover = document.getElementById("color-hue-popover");
  const slider = document.getElementById("color-hue-slider");
  const randomBtn = document.getElementById("btn-bg-hue-random");
  const swatch = hueBtn?.querySelector(".map-color-control__swatch");

  if (!toggle || !hueBtn || !control || !popover || !slider || !randomBtn) return;

  const syncSwatch = () => {
    if (swatch) swatch.style.background = `hsl(${getMapBgHue()}, ${fadeTone.s * 100}%, ${fadeTone.l * 100}%)`;
    slider.value = String(getMapBgHue());
  };

  const syncRandomBtn = () => {
    const random = isMapBgHueRandom();
    randomBtn.setAttribute("aria-pressed", random ? "true" : "false");
    randomBtn.classList.toggle("is-active", random);
  };

  const setOpen = (open) => {
    control.classList.toggle("is-open", open);
    popover.classList.toggle("hidden", !open);
    hueBtn.setAttribute("aria-expanded", open ? "true" : "false");
  };

  toggle.addEventListener("change", () => {
    setMapBgFadeEnabled(toggle.checked);
    if (toggle.checked) applyMapBgFade({ random: hueRandom });
    persistToggles?.();
  });

  hueBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = popover.classList.contains("hidden");
    setOpen(willOpen);
    if (willOpen) {
      syncSwatch();
      syncRandomBtn();
    }
  });

  slider.addEventListener("input", () => {
    const hue = Number(slider.value);
    applyMapBgHue(hue);
    persistBgHue?.(hue);
    syncSwatch();
    syncRandomBtn();
  });

  randomBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const nextRandom = !isMapBgHueRandom();
    setMapBgHueRandom(nextRandom);
    persistBgRandom?.(nextRandom, nextRandom ? null : getMapBgHue());
    syncSwatch();
    syncRandomBtn();
  });

  document.addEventListener("click", (event) => {
    if (!control.contains(event.target)) setOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });

  syncSwatch();
  syncRandomBtn();
}
