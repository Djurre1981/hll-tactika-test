import { useEffect, useRef, useState } from "react";
import "./welcome-page.css";
import { AuthDialog } from "./AuthDialog.jsx";
import { hasPlayedOnce, markPlayedOnce } from "./hooks/oneShot.js";
import { useTypewriter, WELCOME_INTRO_TEXT } from "./hooks/useTypewriter.js";
import { useVideoScrub } from "./hooks/useVideoScrub.js";

const DISCORD_URL = "https://discord.gg/kDaK9wpr8y";
const WELCOME_VIDEO = "/assets/welcome/welcome.mp4";
const LOGO_SRC = "/assets/logos/tactika-full-logo.svg";
const TYPEWRITER_KEY = "tactika:welcome-typewriter";
const NAV_ANIM_KEY = "tactika:welcome-nav";

export function WelcomePage({ authError = null }) {
  const pageRef = useRef(null);
  const videoRef = useRef(null);
  const [dialogOpen, setDialogOpen] = useState(Boolean(authError));
  const [navSettled, setNavSettled] = useState(() => hasPlayedOnce(NAV_ANIM_KEY));
  const { tapToPlay } = useVideoScrub(videoRef, WELCOME_VIDEO, pageRef);
  const { text, isTyping } = useTypewriter(WELCOME_INTRO_TEXT, {
    storageKey: TYPEWRITER_KEY,
  });

  useEffect(() => {
    if (navSettled) return undefined;
    markPlayedOnce(NAV_ANIM_KEY);
    const timer = window.setTimeout(() => setNavSettled(true), 1000);
    return () => window.clearTimeout(timer);
  }, [navSettled]);

  const dialogMessage =
    authError?.message ||
    "Sign in with your Hell Let Loose Steam account to access the platform. Only approved Circle members can have access.";

  return (
    <div
      ref={pageRef}
      className={`welcome-page${tapToPlay ? " scrub-video--tap-to-play" : ""}`}
    >
      <video
        ref={videoRef}
        className="welcome-page__video"
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
      />
      <div className="welcome-page__gradient" aria-hidden="true" />

      <nav
        className={`welcome-page__nav${navSettled ? " is-settled" : ""}`}
        aria-label="Welcome"
      >
        <button
          type="button"
          className="welcome-page__nav-link"
          onClick={() => setDialogOpen(true)}
        >
          Sign in
        </button>
        <span className="welcome-page__nav-sep" aria-hidden="true" />
        <a
          className="welcome-page__nav-link"
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Join us
        </a>
      </nav>

      <div className="welcome-page__brand">
        <p
          className={`welcome-page__intro${isTyping ? " is-typing" : ""}`}
          aria-live="polite"
        >
          {text}
        </p>
        <div className="welcome-page__logo-wrap">
          <img className="welcome-page__logo" src={LOGO_SRC} alt="HLL Tactika" width={840} height={186} />
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
