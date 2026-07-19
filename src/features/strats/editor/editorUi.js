/** Stratmaker-specific tokens + re-exports of shared glass chrome. */

import { STRAT_ICON_OPTIONS } from "@map-kernel/icons/strat-icon-catalog.js";
import {
  HLL_OBJECT_OPTIONS,
  getHllObjectDef,
  getHllToolbarPreviewSrc,
} from "@map-kernel/icons/hll-object-catalog.js";

export {
  actionBtn,
  actionBtnWide,
  cx,
  fieldLabel,
  glassBtn,
  glassIconBtn,
  glassIconBtnActive,
  glassInput,
  glassPillBtn,
  glassSelect,
  glassSurface,
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
  userMenuPill,
} from "../../../shared/glassUi.js";

export const slideItem =
  "flex w-full cursor-pointer items-center gap-[0.45rem] rounded-[10px] border border-solid border-white/10 bg-black/[0.22] px-[0.55rem] py-2 text-left text-[0.78rem] text-white/85 transition";

export const slideItemActive = "border-white/[0.22] bg-white/[0.08]";

export const slideItemDragging = "opacity-55";

export const slideItemDropTarget =
  "border-white/[0.35] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]";

export const slideAction =
  "inline-flex h-[1.15rem] w-[1.35rem] items-center justify-center rounded-[0.35rem] border-0 bg-transparent p-0 text-[0.62rem] text-white/55 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-25";

export const slideActionLg =
  "inline-flex h-[1.6rem] w-[1.6rem] items-center justify-center rounded-[0.35rem] border-0 bg-transparent p-0 text-white/55 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-30";

export const stratPickerTrigger =
  "flex min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-solid border-white/10 bg-black/[0.28] px-[0.7rem] py-[0.55rem] text-left outline-none transition hover:border-white/20 focus-within:border-white/20";

export const accShell =
  "overflow-hidden rounded-[10px] border border-solid border-white/10 bg-black/[0.18]";

export const accSummary =
  "flex cursor-pointer list-none items-center gap-2 px-[0.65rem] py-[0.55rem] [&::-webkit-details-marker]:hidden";

export const accLabel =
  "text-[0.68rem] font-light uppercase tracking-[0.12em] text-white/45";

export const accValue =
  "min-w-0 flex-1 truncate text-right text-[0.74rem] text-white/[0.72]";

export const tagBar =
  "relative grid grid-cols-2 gap-0 rounded-full border border-solid border-white/10 bg-black/[0.22] p-[0.18rem]";

export const tagBarBtn =
  "relative z-[1] border-0 bg-transparent px-[0.55rem] py-[0.45rem] text-[0.72rem] uppercase tracking-[0.08em] text-white/[0.62] transition";

export const tagBarBtnActive = "text-white";

export const COLOR_PRESETS = [
  "#ffffff",
  "#ff4444",
  "#44aaff",
  "#ffcc00",
  "#44dd66",
  "#ff8800",
  "#c084fc",
  "#111111",
];

export const ICON_OPTIONS = STRAT_ICON_OPTIONS;
export const HLL_OPTIONS = HLL_OBJECT_OPTIONS;
export { getHllObjectDef, getHllToolbarPreviewSrc };

/** Icon/title for FA tools; `line` uses a custom glyph in ToolsPanel. */
export const TOOL_ITEMS = [
  { id: "select", icon: "fa-solid fa-arrow-pointer", title: "Select" },
  { id: "pen", icon: "fa-solid fa-pen", title: "Draw" },
  { id: "line", title: "Line / curve / arrow" },
  { id: "ellipse", icon: "fa-regular fa-circle", title: "Circle" },
  { id: "rect", icon: "fa-regular fa-square", title: "Rectangle" },
  { id: "eraser", icon: "fa-solid fa-eraser", title: "Eraser" },
  { id: "text", icon: "fa-solid fa-font", title: "Text" },
  { id: "icons", icon: "fa-solid fa-icons", title: "Icons" },
  { id: "hll", iconSrc: "/assets/logos/hll-mark.png", title: "HLL Objects" },
  { id: "ping", icon: "fa-solid fa-bullseye", title: "Ping" },
];
