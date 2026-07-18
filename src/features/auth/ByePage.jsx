import { useEffect, useRef, useState } from "react";
import "./bye-page.css";
import { hasPlayedOnce, markPlayedOnce } from "./hooks/oneShot.js";
import { BYE_INTRO_TEXT, useTypewriter } from "./hooks/useTypewriter.js";
import { useVideoScrub } from "./hooks/useVideoScrub.js";

const DISCORD_URL = "https://discord.gg/kDaK9wpr8y";
const BYE_VIDEO = "/assets/welcome/bye.mp4";
const LOGO_SRC = "/assets/logos/tactika-full-logo.svg";
const ACTIONS_REVEAL_DELAY_MS = 700;
const TYPEWRITER_KEY = "tactika:bye-typewriter";
const ACTIONS_KEY = "tactika:bye-actions";

export function ByePage({ onGiveUp }) {
  const pageRef = useRef(null);
  const videoRef = useRef(null);
  const actionsAlreadyPlayed = hasPlayedOnce(ACTIONS_KEY);
  const [actionsVisible, setActionsVisible] = useState(actionsAlreadyPlayed);
  const [actionsSettled, setActionsSettled] = useState(actionsAlreadyPlayed);
  const { tapToPlay } = useVideoScrub(videoRef, BYE_VIDEO, pageRef);
  const { text, isTyping, isDone } = useTypewriter(BYE_INTRO_TEXT, {
    speed: 22,
    storageKey: TYPEWRITER_KEY,
  });

  useEffect(() => {
    if (actionsAlreadyPlayed || !isDone) return undefined;

    const timer = window.setTimeout(() => {
      setActionsVisible(true);
      markPlayedOnce(ACTIONS_KEY);
      window.setTimeout(() => setActionsSettled(true), 850);
    }, ACTIONS_REVEAL_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [actionsAlreadyPlayed, isDone]);

  return (
    <div
      ref={pageRef}
      className={`bye-page${tapToPlay ? " scrub-video--tap-to-play" : ""}`}
    >
      <video
        ref={videoRef}
        className="bye-page__video"
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
      />
      <div className="bye-page__gradient" aria-hidden="true" />

      <div className="bye-page__brand">
        <div className="bye-page__logo-wrap">
          <img className="bye-page__logo" src={LOGO_SRC} alt="HLL Tactika" width={840} height={186} />
        </div>
      </div>

      <div className="bye-page__footer">
        {actionsVisible ? (
          <div
            className={`bye-page__actions${actionsSettled ? " is-settled" : " is-visible"}`}
          >
            <a
              className="bye-page__action"
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Join us
            </a>
            <button type="button" className="bye-page__action" onClick={onGiveUp}>
              Give up
            </button>
          </div>
        ) : null}

        <p
          className={`bye-page__intro${isTyping ? " is-typing" : ""}`}
          aria-live="polite"
        >
          {text}
        </p>
      </div>
    </div>
  );
}
