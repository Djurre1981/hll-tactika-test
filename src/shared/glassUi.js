/** Shared glass / panel Tailwind tokens for Stratmaker + Micro-Prep chrome. */

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

export const userMenuPill =
  "inline-flex min-h-10 w-full items-center justify-center whitespace-nowrap rounded-full border border-solid border-white/[0.14] bg-[rgba(50,50,50,0.85)] px-[0.9rem] py-[0.45rem] text-center text-[0.72rem] font-light uppercase tracking-[0.1em] text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-[20px] backdrop-saturate-[180%] transition hover:border-white/[0.22] hover:text-white disabled:opacity-40";

export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}
