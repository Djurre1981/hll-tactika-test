/** Text style helpers — fonts, shadow, canvas font string. Vanilla only. */

export const TEXT_FONTS = [
  { id: "Inter", label: "Inter", css: '"Inter", sans-serif' },
  { id: "Roboto", label: "Roboto", css: '"Roboto", sans-serif' },
  { id: "Open Sans", label: "Open Sans", css: '"Open Sans", sans-serif' },
  { id: "Lato", label: "Lato", css: '"Lato", sans-serif' },
  { id: "Montserrat", label: "Montserrat", css: '"Montserrat", sans-serif' },
  { id: "Oswald", label: "Oswald", css: '"Oswald", sans-serif' },
  { id: "Nunito", label: "Nunito", css: '"Nunito", sans-serif' },
  { id: "Merriweather", label: "Merriweather", css: '"Merriweather", serif' },
  { id: "Playfair Display", label: "Playfair Display", css: '"Playfair Display", serif' },
  { id: "Roboto Mono", label: "Roboto Mono", css: '"Roboto Mono", monospace' },
];

const FONT_IDS = new Set(TEXT_FONTS.map((f) => f.id));

/** 3×3 shadow grid; center cell = no shadow. */
export const TEXT_SHADOW_CELLS = ["nw", "n", "ne", "w", "none", "e", "sw", "s", "se"];

const TEXT_VALIGNS = ["top", "middle", "bottom"];

export function resolveFontCss(fontFamily) {
  const hit = TEXT_FONTS.find((f) => f.id === fontFamily);
  return hit?.css || '"Inter", sans-serif';
}

export function isOutlineNone(color) {
  const c = String(color || "").trim().toLowerCase();
  return !c || c === "none" || c === "transparent";
}

/** Subtle map-% offset from font size. */
export function shadowOffsetPct(shadow, fontSize = 10) {
  const d = Math.max(0.2, Number(fontSize) * 0.06);
  switch (shadow) {
    case "nw":
      return { x: -d, y: -d };
    case "n":
      return { x: 0, y: -d };
    case "ne":
      return { x: d, y: -d };
    case "w":
      return { x: -d, y: 0 };
    case "e":
      return { x: d, y: 0 };
    case "sw":
      return { x: -d, y: d };
    case "s":
      return { x: 0, y: d };
    case "se":
      return { x: d, y: d };
    default:
      return { x: 0, y: 0 };
  }
}

export function buildCanvasFont(style, fontPx) {
  const italic = style.italic ? "italic " : "";
  const weight = style.bold ? "700" : "400";
  return `${italic}${weight} ${Math.max(1, fontPx)}px ${resolveFontCss(style.fontFamily)}`;
}

/**
 * Normalize text-only style fields. Preserves legacy `textStyle` (0/1/2).
 */
export function normalizeTextFields(style = {}) {
  const legacy = Number(style.textStyle);
  const bold =
    style.bold != null ? Boolean(style.bold) : legacy === 2;
  const italic =
    style.italic != null ? Boolean(style.italic) : legacy === 1;
  const fontFamily = FONT_IDS.has(style.fontFamily) ? style.fontFamily : "Inter";
  const shadow = TEXT_SHADOW_CELLS.includes(style.shadow) ? style.shadow : "none";
  const textVAlign = TEXT_VALIGNS.includes(style.textVAlign) ? style.textVAlign : "middle";
  const outlineColor = isOutlineNone(style.outlineColor)
    ? "none"
    : String(style.outlineColor).slice(0, 32);
  const outlineWidth = Math.min(
    24,
    Math.max(0, Number.isFinite(Number(style.outlineWidth)) ? Number(style.outlineWidth) : 0)
  );
  const padding = Math.min(
    24,
    Math.max(0, Number.isFinite(Number(style.padding)) ? Number(style.padding) : 2)
  );
  let rotation = Number(style.rotation) || 0;
  if (!Number.isFinite(rotation)) rotation = 0;
  rotation = ((rotation % 360) + 360) % 360;
  if (rotation > 180) rotation -= 360;

  return {
    fontFamily,
    bold,
    italic,
    underline: Boolean(style.underline),
    textVAlign,
    outlineColor,
    outlineWidth,
    shadow,
    padding,
    rotation,
    // Keep legacy field in sync for older readers.
    textStyle: bold ? 2 : italic ? 1 : 0,
  };
}
