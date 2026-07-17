import { useRef, useState } from "react";
import { useFadeIn } from "../../shared/hooks/useFadeIn.js";
import { AuthDialog } from "./AuthDialog.jsx";
import { useTypewriter, WELCOME_INTRO_TEXT } from "./hooks/useTypewriter.js";
import { useVideoScrub } from "./hooks/useVideoScrub.js";

const DISCORD_URL = "https://discord.gg/kDaK9wpr8y";
const WELCOME_VIDEO = "/assets/welcome/welcome.mp4";
const LOGO_SRC = "/assets/logos/tactika-full-logo.svg";

export function WelcomePage({ authError = null }) {
  const videoRef = useRef(null);
  const [dialogOpen, setDialogOpen] = useState(Boolean(authError));
  const { tapToPlay } = useVideoScrub(videoRef, WELCOME_VIDEO);
  const { text, isTyping, cursorVisible } = useTypewriter(WELCOME_INTRO_TEXT);
  const navStyle = useFadeIn({ delay: 100, duration: 800 });

  const dialogMessage =
    authError?.message ||
    "Sign in with your Hell Let Loose Steam account to access the platform. Only approved Circle members can have access.";

  return (
    <div className="fixed inset-0 z-[150] overflow-hidden bg-black font-sans">
      <video
        ref={videoRef}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        muted
        playsInline
        disablePictureInPicture
        disableRemotePlayback
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/20"
        aria-hidden="true"
      />

      {tapToPlay ? (
        <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center text-sm font-light uppercase tracking-[0.14em] text-white/75">
          Tap to play
        </div>
      ) : null}

      <nav
        className="absolute right-[5.5rem] top-9 z-[3] flex items-center gap-7 max-md:right-14 max-md:top-6 max-md:gap-5"
        style={navStyle}
        aria-label="Welcome"
      >
        <button
          type="button"
          className="cursor-pointer border-none bg-transparent text-[1.15rem] font-light tracking-[0.12em] text-white transition hover:opacity-65 max-md:text-[1.05rem]"
          onClick={() => setDialogOpen(true)}
        >
          Sign in
        </button>
        <span className="h-[3px] w-[3px] shrink-0 rounded-full bg-white/55" aria-hidden="true" />
        <a
          className="text-[1.15rem] font-light tracking-[0.12em] text-white no-underline transition hover:opacity-65 max-md:text-[1.05rem]"
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Join us
        </a>
      </nav>

      <div className="pointer-events-none absolute bottom-[calc(19.625rem-min(72vw,840px)*186/840)] left-[5.5rem] z-[3] flex w-[min(72vw,840px)] select-none flex-col items-start max-md:left-10 max-md:w-[min(82vw,640px)]">
        <p
          className="mb-0 box-border h-[8.25em] w-full max-w-full px-[4%] pb-0 pt-[4.5em] text-left text-[clamp(0.82rem,1.05vw,1rem)] font-thin leading-[1.65] tracking-[0.03em] text-white/90"
          aria-live="polite"
        >
          {text}
          {isTyping ? (
            <span
              className="ml-0.5 inline-block h-[0.95em] w-px bg-white/80 align-text-bottom"
              style={{ opacity: cursorVisible ? 1 : 0 }}
            />
          ) : null}
        </p>
        <div className="relative w-full">
          <img className="block h-auto w-full" src={LOGO_SRC} alt="HLL Tactika" width={840} height={186} />
        </div>
      </div>

      <AuthDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        message={dialogMessage}
        showLogin={authError?.showLogin !== false}
      />
    </div>
  );
}
