import { initWelcomeTypewriter } from "./welcome-typewriter.js";
import { hideDashboardView } from "./dashboard.js";
import {
  getAuthEls,
  clearAuthPending,
  setStoredAuthSession,
  closeAuthDialog,
  openAuthDialog,
  DEFAULT_AUTH,
} from "./auth-gate.js";

const BYE_VIDEO_SRC = "/assets/welcome/bye.mp4";
const BYE_TYPEWRITER_SPEED = 22;
const BYE_ACTIONS_REVEAL_DELAY_MS = 700;

let scrubController = null;
let typewriterController = null;
let byeScrubController = null;
let byeTypewriterController = null;
let byeActionsRevealTimer = null;

function loadWelcomeScrub() {
  return import("./welcome-scrub.js");
}

function preloadVideoAsset(href) {
  if (document.querySelector(`link[rel="preload"][href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "video";
  link.href = href;
  link.type = "video/mp4";
  document.head.appendChild(link);
}

function destroyWelcomeScrub() {
  scrubController?.destroy();
  scrubController = null;
}

function destroyTypewriter() {
  typewriterController?.destroy();
  typewriterController = null;
}

function startTypewriter() {
  destroyTypewriter();
  typewriterController = initWelcomeTypewriter(document.getElementById("welcome-intro"));
}

function clearByeActionsRevealTimer() {
  if (!byeActionsRevealTimer) return;
  window.clearTimeout(byeActionsRevealTimer);
  byeActionsRevealTimer = null;
}

function resetByeActions() {
  clearByeActionsRevealTimer();
  const els = getAuthEls();
  if (!els.byeActions) return;
  els.byeActions.hidden = true;
  els.byeActions.classList.remove("is-visible");
}

function revealByeActions() {
  clearByeActionsRevealTimer();
  byeActionsRevealTimer = window.setTimeout(() => {
    byeActionsRevealTimer = null;
    const els = getAuthEls();
    if (!els.byeActions) return;
    els.byeActions.hidden = false;
    els.byeActions.classList.add("is-visible");
  }, BYE_ACTIONS_REVEAL_DELAY_MS);
}

function startByeTypewriter() {
  destroyByeTypewriter();
  resetByeActions();
  byeTypewriterController = initWelcomeTypewriter(document.getElementById("bye-intro"), {
    speed: BYE_TYPEWRITER_SPEED,
    onComplete: revealByeActions,
  });
}

function destroyByeScrub() {
  byeScrubController?.destroy();
  byeScrubController = null;
}

function destroyByeTypewriter() {
  byeTypewriterController?.destroy();
  byeTypewriterController = null;
}

function showWelcome({ openDialog = false, dialogContent = DEFAULT_AUTH } = {}) {
  const els = getAuthEls();
  hideBye();
  clearAuthPending();
  setStoredAuthSession(false);
  document.documentElement.classList.remove("app-boot", "bye-boot", "dashboard-boot");
  document.documentElement.classList.add("welcome-boot");
  els.welcomePage?.classList.remove("is-hidden");
  els.appRoot?.classList.add("hidden");
  els.userCluster?.classList.add("hidden");
  els.modeSwitch?.classList.add("hidden");
  els.hubChrome?.classList.add("hidden");
  els.dashboardPage?.classList.add("hidden");
  hideDashboardView();

  scrubController = els.scrubVideo?.__welcomeScrub ?? null;
  if (els.scrubVideo && !scrubController) {
    void loadWelcomeScrub().then(({ initWelcomeScrub }) => {
      scrubController = initWelcomeScrub(els.scrubVideo);
    });
  }

  startTypewriter();

  if (openDialog) {
    openAuthDialog(dialogContent);
  } else {
    closeAuthDialog();
  }
}

function hideWelcome() {
  const els = getAuthEls();
  document.documentElement.classList.remove("welcome-boot");
  els.welcomePage?.classList.add("is-hidden");
  destroyWelcomeScrub();
  destroyTypewriter();
  closeAuthDialog();
}

function showBye() {
  const els = getAuthEls();
  clearAuthPending();
  setStoredAuthSession(false);
  document.documentElement.classList.remove("app-boot", "welcome-boot", "dashboard-boot");
  document.documentElement.classList.add("bye-boot");
  els.welcomePage?.classList.add("is-hidden");
  destroyWelcomeScrub();
  destroyTypewriter();
  els.byePage?.classList.remove("is-hidden");
  els.appRoot?.classList.add("hidden");
  els.userCluster?.classList.add("hidden");
  els.modeSwitch?.classList.add("hidden");
  els.hubChrome?.classList.add("hidden");
  els.dashboardPage?.classList.add("hidden");
  hideDashboardView();
  closeAuthDialog();

  preloadVideoAsset(BYE_VIDEO_SRC);

  byeScrubController = els.byeScrubVideo?.__welcomeScrub ?? null;
  if (els.byeScrubVideo && !byeScrubController) {
    void loadWelcomeScrub().then(({ initWelcomeScrub }) => {
      byeScrubController = initWelcomeScrub(els.byeScrubVideo);
    });
  }

  startByeTypewriter();
}

function hideBye() {
  const els = getAuthEls();
  document.documentElement.classList.remove("bye-boot");
  els.byePage?.classList.add("is-hidden");
  destroyByeScrub();
  destroyByeTypewriter();
  resetByeActions();
}

export {
  loadWelcomeScrub,
  preloadVideoAsset,
  destroyWelcomeScrub,
  destroyTypewriter,
  startTypewriter,
  destroyByeScrub,
  destroyByeTypewriter,
  startByeTypewriter,
  showWelcome,
  hideWelcome,
  showBye,
  hideBye,
};
