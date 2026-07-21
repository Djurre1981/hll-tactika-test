/** Micro-prep tool list + drawing presets; glass tokens from shared. */

export {
  actionBtn,
  actionBtnWide,
  cx,
  glassInput,
  glassSelect,
  optionRow,
  panelBody,
  panelDivider,
  panelGlassFill,
  panelShell,
  sectionTitle,
  segmentedBtn,
  segmentedBtnActive,
  toolBtn,
  toolBtnActive,
} from "../../shared/glassUi.js";

/** Micro-prep kernel tool list (Strat drawing subset + HLL map page insert). */
export const MICRO_PREP_TOOL_ITEMS = [
  { id: "select", icon: "fa-solid fa-arrow-pointer", title: "Select" },
  { id: "pen", icon: "fa-solid fa-pen", title: "Draw" },
  { id: "highlighter", icon: "fa-solid fa-highlighter", title: "Highlighter" },
  { id: "line", title: "Line / curve / arrow" },
  { id: "ellipse", icon: "fa-regular fa-circle", title: "Ellipse" },
  { id: "rect", icon: "fa-regular fa-square", title: "Rectangle" },
  { id: "sticky", icon: "fa-solid fa-note-sticky", title: "Sticky note" },
  { id: "text", icon: "fa-solid fa-font", title: "Text" },
  { id: "eraser", icon: "fa-solid fa-eraser", title: "Eraser" },
  { id: "hll-map", icon: "fa-solid fa-map-location-dot", title: "HLL Map" },
];

/** @deprecated Excalidraw tool list — kept for reference during migration cleanup */
export const WB_TOOL_ITEMS = [
  { id: "selection", icon: "fa-solid fa-arrow-pointer", title: "Select" },
  { id: "freedraw", icon: "fa-solid fa-pen", title: "Draw" },
  { id: "highlighter", icon: "fa-solid fa-highlighter", title: "Highlighter" },
  { id: "line", icon: "fa-solid fa-minus", title: "Line" },
  { id: "arrow", icon: "fa-solid fa-arrow-right-long", title: "Arrow" },
  { id: "ellipse", icon: "fa-regular fa-circle", title: "Ellipse" },
  { id: "rectangle", icon: "fa-regular fa-square", title: "Rectangle" },
  { id: "sticky", icon: "fa-solid fa-note-sticky", title: "Sticky note" },
  { id: "text", icon: "fa-solid fa-font", title: "Text" },
  { id: "image", icon: "fa-regular fa-image", title: "Image" },
  { id: "hll-map", icon: "fa-solid fa-map-location-dot", title: "HLL Map" },
  { id: "eraser", icon: "fa-solid fa-eraser", title: "Eraser" },
  { id: "hand", icon: "fa-regular fa-hand", title: "Pan" },
];

export const STROKE_COLORS = [
  "#ffffff",
  "#1e1e1e",
  "#e03131",
  "#2f9e44",
  "#1971c2",
  "#f08c00",
  "#9c36b5",
];

export const BG_COLORS = [
  "transparent",
  "#ffffff",
  "#ffc9c9",
  "#b2f2bb",
  "#a5d8ff",
  "#ffec99",
  "#eebefa",
];

export const STROKE_WIDTHS = [
  { value: 1, label: "S" },
  { value: 2, label: "M" },
  { value: 4, label: "L" },
];

export const FILL_STYLES = [
  { value: "hachure", title: "Hachure", icon: "fa-solid fa-bars" },
  { value: "cross-hatch", title: "Cross-hatch", icon: "fa-solid fa-table-cells" },
  { value: "solid", title: "Solid", icon: "fa-solid fa-square" },
];

export const STROKE_STYLES = [
  { value: "solid", title: "Solid", icon: "fa-solid fa-minus" },
  { value: "dashed", title: "Dashed", icon: "fa-solid fa-grip-lines" },
  { value: "dotted", title: "Dotted", icon: "fa-solid fa-ellipsis" },
];

export const ROUGHNESS = [
  { value: 0, title: "Architect", icon: "fa-solid fa-ruler" },
  { value: 1, title: "Artist", icon: "fa-solid fa-pencil" },
  { value: 2, title: "Cartoonist", icon: "fa-regular fa-face-smile" },
];

export const EDGE_STYLES = [
  { value: "sharp", title: "Sharp", icon: "fa-regular fa-square" },
  { value: "round", title: "Round", icon: "fa-solid fa-square" },
];

export const FONT_SIZES = [
  { value: 16, label: "S" },
  { value: 20, label: "M" },
  { value: 28, label: "L" },
  { value: 36, label: "XL" },
];

export const DEFAULT_DRAW_SETTINGS = {
  strokeColor: "#ffffff",
  backgroundColor: "transparent",
  fillStyle: "hachure",
  strokeWidth: 2,
  strokeStyle: "solid",
  roughness: 1,
  opacity: 100,
  roundness: "round",
  fontSize: 20,
};

export function toolHasStroke(tool) {
  return ["freedraw", "highlighter", "line", "arrow", "ellipse", "rectangle", "sticky", "text"].includes(
    tool
  );
}

export function toolHasFill(tool) {
  return ["ellipse", "rectangle", "sticky"].includes(tool);
}

export function toolHasStrokeStyle(tool) {
  return ["freedraw", "highlighter", "line", "arrow", "ellipse", "rectangle", "sticky"].includes(
    tool
  );
}

export function toolHasRoughness(tool) {
  return ["line", "arrow", "ellipse", "rectangle", "sticky", "freedraw"].includes(tool);
}

export function toolHasEdges(tool) {
  return ["rectangle", "sticky"].includes(tool);
}

export function toolHasFont(tool) {
  return tool === "text";
}

export function toolHasSettings(tool) {
  return toolHasStroke(tool);
}
