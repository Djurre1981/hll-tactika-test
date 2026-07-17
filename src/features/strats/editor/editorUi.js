/** Legacy stratmaker visual tokens as Tailwind class strings (reference only — no CSS imports). */

export const panelShell =
  "relative flex h-full flex-col overflow-hidden rounded-[16px] border border-solid border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.28)]";

export const panelGlassFill =
  "pointer-events-none absolute inset-0 rounded-[16px] bg-[rgba(24,24,26,0.58)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(255,255,255,0.04)] backdrop-blur-[20px] backdrop-saturate-[180%]";

export const panelBody = "relative z-[1] flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4";

export const sectionTitle =
  "m-0 text-[0.68rem] font-light uppercase tracking-[0.14em] text-white/45";

export const panelDivider = "h-px w-full shrink-0 bg-white/[0.08]";

export const glassIconBtn =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-solid border-white/10 bg-transparent text-[1rem] leading-none text-white/90 outline-none transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35";

export const glassIconBtnActive =
  "border-white/20 bg-white/12 text-white hover:border-white/20 hover:bg-white/12";

export const glassBtn =
  "inline-flex items-center justify-center gap-2 rounded-[10px] border border-solid border-white/10 bg-transparent px-3 py-1.5 text-[0.72rem] font-light uppercase tracking-[0.06em] text-white/90 outline-none transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35";

export const glassInput =
  "w-full rounded-full border border-solid border-white/10 bg-black/20 px-3.5 py-[0.55rem] text-[0.78rem] font-light tracking-[0.02em] text-white/90 outline-none transition placeholder:text-white/35 focus:border-white/25 focus:bg-black/30 focus:outline-none disabled:opacity-35";

export const glassSelect =
  "w-full appearance-none rounded-full border border-solid border-white/10 bg-black/25 py-[0.55rem] pl-3.5 pr-8 text-[0.78rem] font-light tracking-[0.04em] text-white/90 outline-none transition focus:border-white/25 focus:outline-none disabled:opacity-35";

export const glassPillBtn =
  "flex w-full items-center justify-center rounded-full border border-solid border-white/10 bg-white/[0.07] px-4 py-[0.65rem] text-[0.78rem] font-light uppercase tracking-[0.1em] text-white/90 transition hover:border-white/20 hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-40";

export const glassSurface =
  "relative rounded-[16px] border border-solid border-white/10 bg-[rgba(50,50,50,0.85)] shadow-[0_24px_80px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(255,255,255,0.04)] backdrop-blur-[20px] backdrop-saturate-[180%]";

export const toolBtn =
  "flex aspect-square items-center justify-center rounded-[10px] border border-solid border-white/10 bg-transparent text-[0.9rem] text-white/[0.72] outline-none transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35";

export const toolBtnActive =
  "border-white/20 bg-white/12 text-white hover:border-white/20 hover:bg-white/12";

export const actionBtn =
  "inline-flex h-8 items-center justify-center gap-2 rounded-[10px] border border-solid border-white/10 bg-transparent px-2.5 text-[0.72rem] text-white/[0.72] outline-none transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35";

export const actionBtnWide = `${actionBtn} w-full py-2 text-[0.78rem]`;

export const segmentedBtn =
  "inline-flex h-[1.8rem] min-w-[1.8rem] items-center justify-center rounded-[10px] border border-solid border-white/10 bg-transparent px-[0.35rem] text-[0.72rem] text-white/[0.72] outline-none transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white focus:outline-none disabled:opacity-35";

export const segmentedBtnActive =
  "border-white/20 bg-white/12 text-white hover:bg-white/12";

export const optionRow =
  "mb-[0.55rem] grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-[0.45rem] text-[0.76rem] text-white/[0.72]";

export const fieldLabel = "block text-[0.7rem] font-light text-white/45";

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

export const userMenuPill =
  "inline-flex min-h-10 w-full items-center justify-center whitespace-nowrap rounded-full border border-solid border-white/[0.14] bg-[rgba(50,50,50,0.85)] px-[0.9rem] py-[0.45rem] text-center text-[0.72rem] font-light uppercase tracking-[0.1em] text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-[20px] backdrop-saturate-[180%] transition hover:border-white/[0.22] hover:text-white disabled:opacity-40";

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

export const ICON_OPTIONS = [
  { id: "check", icon: "fa-check" },
  { id: "xmark", icon: "fa-xmark" },
  { id: "circle-question", icon: "fa-circle-question" },
  { id: "circle-info", icon: "fa-circle-info" },
  { id: "triangle-exclamation", icon: "fa-triangle-exclamation" },
  { id: "house", icon: "fa-house" },
  { id: "ban", icon: "fa-ban" },
  { id: "binoculars", icon: "fa-binoculars" },
  { id: "bomb", icon: "fa-bomb" },
  { id: "car-side", icon: "fa-car-side" },
  { id: "truck-pickup", icon: "fa-truck-pickup" },
  { id: "jet-fighter", icon: "fa-jet-fighter" },
  { id: "crosshairs", icon: "fa-crosshairs" },
  { id: "flag", icon: "fa-flag" },
  { id: "gun", icon: "fa-gun" },
  { id: "shield", icon: "fa-shield" },
  { id: "skull-crossbones", icon: "fa-skull-crossbones" },
  { id: "person-rifle", icon: "fa-person-rifle" },
  { id: "map-pin", icon: "fa-map-pin" },
  { id: "location-dot", icon: "fa-location-dot" },
];

export const TOOL_ITEMS = [
  { id: "select", icon: "fa-solid fa-arrow-pointer", title: "Select" },
  { id: "pen", icon: "fa-solid fa-pen", title: "Draw" },
  { id: "line", icon: "fa-solid fa-minus", title: "Line" },
  { id: "ellipse", icon: "fa-regular fa-circle", title: "Circle" },
  { id: "rect", icon: "fa-regular fa-square", title: "Rectangle" },
  { id: "eraser", icon: "fa-solid fa-eraser", title: "Eraser" },
  { id: "text", icon: "fa-solid fa-font", title: "Text" },
  { id: "arrow", icon: "fa-solid fa-arrow-right-long", title: "Arrow" },
  { id: "icons", icon: "fa-solid fa-icons", title: "Icons" },
  { id: "ping", icon: "fa-solid fa-bullseye", title: "Ping" },
];

export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}
