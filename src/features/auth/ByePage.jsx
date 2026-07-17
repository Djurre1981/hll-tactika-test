import { useEffect, useRef, useState } from "react";
import { useFadeIn } from "../../shared/hooks/useFadeIn.js";
import { BYE_INTRO_TEXT, useTypewriter } from "./hooks/useTypewriter.js";
import { useVideoScrub } from "./hooks/useVideoScrub.js";

const DISCORD_URL = "https://discord.gg/kDaK9wpr8y";
const BYE_VIDEO = "/assets/welcome/bye.mp4";
const LOGO_SRC = "/assets/logos/tactika-full-logo.svg";
const ACTIONS_REVEAL_DELAY_MS = 700;

export function ByePage({ onGiveUp }) {
  const videoRef = useRef(null);
  const [actionsVisible, setActionsVisible] = useState(false);
  const { tapToPlay } = useVideoScrub(videoRef, BYE_VIDEO);
  const { text, isTyping, isDone, cursorVisible } = useTypewriter(BYE_INTRO_TEXT, { speed: 22 });
  const actionsStyle = useFadeIn({
    delay: 0,
    duration: 800,
    enabled: actionsVisible,
  });

  useEffect(() => {
    if (!isDone) {
      setActionsVisible(false);
      return undefined;
    }

    const timer = window.setTimeout(() => setActionsVisible(true), ACTIONS_REVEAL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isDone]);

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
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-black/10 to-black/60"
        aria-hidden="true"
      />

      {tapToPlay ? (
        <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center text-sm font-light uppercase tracking-[0.14em] text-white/75">
          Tap to play
        </div>
      ) : null}

      <div className="pointer-events-none absolute left-[4.75rem] top-9 z-[3] w-[min(72vw,840px)] select-none max-md:left-9 max-md:top-6 max-md:w-[min(82vw,640px)]">
        <img className="block h-auto w-full" src={LOGO_SRC} alt="HLL Tactika" width={840} height={186} />
      </div>

      <div className="absolute bottom-[5.5rem] left-1/2 z-[3] flex w-[min(72vw,840px)] -translate-x-1/2 flex-col items-center max-md:bottom-16 max-md:w-[min(82vw,640px)]">
        {actionsVisible ? (
          <div
            className="mb-6 flex w-full justify-between px-[5.5rem] max-md:px-14"
            style={actionsStyle}
          >
            <a
              className="cursor-pointer border-none bg-transparent text-[1.15rem] font-light tracking-[0.12em] text-white no-underline transition hover:opacity-65 max-md:text-[1.05rem]"
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Join us
            </a>
            <button
              type="button"
              className="cursor-pointer border-none bg-transparent text-[1.15rem] font-light tracking-[0.12em] text-white transition hover:opacity-65 max-md:text-[1.05rem]"
              onClick={onGiveUp}
            >
              Give up
            </button>
          </div>
        ) : null}

        <p
          className="m-0 w-full text-center text-[clamp(0.82rem,1.05vw,1rem)] font-thin leading-[1.65] tracking-[0.03em] text-white/90"
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
      </div>
    </div>
  );
}
