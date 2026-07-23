import { useHelpWiki } from "./HelpWikiContext.jsx";

const helpBtnClass =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-solid border-white/15 bg-white/[0.06] text-[1.05rem] font-medium leading-none text-white/85 backdrop-blur-[20px] backdrop-saturate-[160%] transition hover:border-white/32 hover:bg-white/[0.1] hover:text-white hover:shadow-[0_0_20px_rgba(255,255,255,0.08)] focus:outline-none focus-visible:border-white/40";

/** Opens the in-app wiki overlay — place beside the avatar. */
export function HelpWikiButton({ className = "" }) {
  const { openWiki } = useHelpWiki();

  return (
    <button
      type="button"
      className={`${helpBtnClass} ${className}`.trim()}
      aria-label="Open help manual"
      title="Help"
      onClick={() => openWiki("Home")}
    >
      ?
    </button>
  );
}
