import { fetchCurrentUser, logout, setCurrentUser } from "../api/auth.js";
import { notifyRateLimited } from "../helpers/rate-limit-ui.js";
import { initWelcomeTypewriter } from "./welcome-typewriter.js";

const DEFAULT_AUTH = {
  title: "CIRCLE COMP LOGIN",
  message:
    "Sign in with your Hell Let Loose Steam account to access the platform. Only approved Circle members can have access.",
};

const AUTH_CLOSE_MS = 500;
const AUTH_BOOT_KEY = "hll-tactika-authed";
const WELCOME_SCRUB_MODULE = new URL("./welcome-scrub.js", import.meta.url);
const BYE_VIDEO_SRC = "assets/welcome/bye.mp4";

function preloadVideoAsset(href) {
  if (document.querySelector(`link[rel="preload"][href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "video";
  link.href = href;
  link.type = "video/mp4";
  document.head.appendChild(link);
}

function setStoredAuthSession(active) {
  try {
    if (active) localStorage.setItem(AUTH_BOOT_KEY, "1");
    else localStorage.removeItem(AUTH_BOOT_KEY);
  } catch {}
}

let scrubController = null;
let typewriterController = null;
let byeScrubController = null;
let byeTypewriterController = null;
let byeActionsRevealTimer = null;
let byeUiBound = false;

const BYE_TYPEWRITER_SPEED = 22;
const BYE_ACTIONS_REVEAL_DELAY_MS = 700;

function getAuthEls() {
  return {
    welcomePage: document.getElementById("welcome-page"),
    byePage: document.getElementById("bye-page"),
    byeActions: document.getElementById("bye-actions"),
    btnByeGiveUp: document.getElementById("btn-bye-give-up"),
    appRoot: document.getElementById("app-root"),
    modeSwitch: document.getElementById("mode-switch"),
    gate: document.getElementById("auth-gate"),
    gateTitle: document.getElementById("auth-gate-title"),
    gateMessage: document.getElementById("auth-gate-message"),
    btnSteamLogin: document.getElementById("btn-steam-login"),
    btnWelcomeSignIn: document.getElementById("btn-welcome-sign-in"),
    btnAuthClose: document.getElementById("btn-auth-close"),
    userCluster: document.getElementById("user-cluster"),
    userAvatar: document.getElementById("user-avatar"),
    userName: document.getElementById("user-name"),
    btnLogout: document.getElementById("btn-logout"),
    scrubVideo: document.getElementById("welcome-scrub-video"),
    byeScrubVideo: document.getElementById("bye-scrub-video"),
  };
}

function getAuthErrorFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const auth = params.get("auth");
  const steamId = params.get("steamId");
  if (!auth) return null;

  if (auth === "forbidden") {
    const idHint = steamId
      ? ` Your Steam ID64 is ${steamId} — send this to an admin to be added.`
      : "";
    return {
      type: "forbidden",
      message: `Your Steam account is not on the member list yet.${idHint}`,
    };
  }
  if (auth === "error") {
    return {
      type: "error",
      message: "Steam sign-in failed. Please try again.",
    };
  }
  return null;
}

function clearAuthQuery() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("auth")) return;
  url.searchParams.delete("auth");
  url.searchParams.delete("steamId");
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
}

function setAuthDialogContent({ title, message, showLogin = true }) {
  const els = getAuthEls();
  if (els.gateTitle) els.gateTitle.textContent = title;
  if (els.gateMessage) els.gateMessage.textContent = message;
  els.btnSteamLogin?.classList.toggle("hidden", !showLogin);
}

function openAuthDialog(content) {
  const els = getAuthEls();
  if (!els.gate) return;
  setAuthDialogContent(content);
  els.gate.classList.remove("is-closing");
  if (!els.gate.open) {
    els.gate.showModal();
  }
}

function closeAuthDialog() {
  const els = getAuthEls();
  if (!els.gate?.open || els.gate.classList.contains("is-closing")) return;

  els.gate.classList.add("is-closing");
  let done = false;

  const finishClose = () => {
    if (done) return;
    done = true;
    els.gate.classList.remove("is-closing");
    if (els.gate.open) els.gate.close();
  };

  els.gate.addEventListener("animationend", finishClose, { once: true });
  window.setTimeout(finishClose, AUTH_CLOSE_MS + 50);
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

function clearAuthPending() {
  getAuthEls().appRoot?.classList.remove("is-auth-pending");
}

function showAuthPending() {
  const els = getAuthEls();
  document.documentElement.classList.remove("welcome-boot", "bye-boot");
  document.documentElement.classList.add("app-boot");
  els.welcomePage?.classList.add("is-hidden");
  els.byePage?.classList.add("is-hidden");
  els.appRoot?.classList.add("is-auth-pending");
}

function showWelcome({ openDialog = false, dialogContent = DEFAULT_AUTH } = {}) {
  const els = getAuthEls();
  hideBye();
  clearAuthPending();
  setStoredAuthSession(false);
  document.documentElement.classList.remove("app-boot", "bye-boot");
  document.documentElement.classList.add("welcome-boot");
  els.welcomePage?.classList.remove("is-hidden");
  els.appRoot?.classList.add("hidden");
  els.userCluster?.classList.add("hidden");
  els.modeSwitch?.classList.add("hidden");

  scrubController = els.scrubVideo?.__welcomeScrub ?? null;
  if (els.scrubVideo && !scrubController) {
    void import(WELCOME_SCRUB_MODULE).then(({ initWelcomeScrub }) => {
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
  document.documentElement.classList.add("app-boot");
  els.welcomePage?.classList.add("is-hidden");
  destroyWelcomeScrub();
  destroyTypewriter();
  closeAuthDialog();
}

function destroyByeScrub() {
  byeScrubController?.destroy();
  byeScrubController = null;
}

function destroyByeTypewriter() {
  byeTypewriterController?.destroy();
  byeTypewriterController = null;
}

function clearByeActionsRevealTimer() {
  if (!byeActionsRevealTimer) return;
  window.clearTimeout(byeActionsRevealTimer);
  byeActionsRevealTimer = null;
}

function resetByeActions() {
  const els = getAuthEls();
  clearByeActionsRevealTimer();
  if (!els.byeActions) return;
  els.byeActions.hidden = true;
  els.byeActions.classList.remove("is-visible");
}

function revealByeActions() {
  const els = getAuthEls();
  if (!els.byeActions) return;
  clearByeActionsRevealTimer();
  byeActionsRevealTimer = window.setTimeout(() => {
    byeActionsRevealTimer = null;
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

function showBye() {
  const els = getAuthEls();
  clearAuthPending();
  setStoredAuthSession(false);
  document.documentElement.classList.remove("app-boot", "welcome-boot");
  document.documentElement.classList.add("bye-boot");
  els.welcomePage?.classList.add("is-hidden");
  destroyWelcomeScrub();
  destroyTypewriter();
  els.byePage?.classList.remove("is-hidden");
  els.appRoot?.classList.add("hidden");
  els.userCluster?.classList.add("hidden");
  els.modeSwitch?.classList.add("hidden");
  closeAuthDialog();

  preloadVideoAsset(BYE_VIDEO_SRC);

  byeScrubController = els.byeScrubVideo?.__welcomeScrub ?? null;
  if (els.byeScrubVideo && !byeScrubController) {
    void import(WELCOME_SCRUB_MODULE).then(({ initWelcomeScrub }) => {
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

function showApp(user) {
  const els = getAuthEls();
  clearAuthPending();
  setCurrentUser(user);
  setStoredAuthSession(true);
  hideBye();
  hideWelcome();
  els.appRoot?.classList.remove("hidden");
  els.userCluster?.classList.remove("hidden");
  els.modeSwitch?.classList.remove("hidden");

  const label = user.name || `Steam user ${user.steamId}`;
  if (els.userName) els.userName.textContent = label;
  if (user.role === "viewer") {
    els.modeSwitch?.classList.add("hidden");
  } else {
    els.modeSwitch?.classList.remove("hidden");
  }
  if (user.avatar) {
    if (els.userAvatar) {
      els.userAvatar.src = user.avatar;
      els.userAvatar.alt = label;
      els.userAvatar.classList.remove("hidden");
    }
  } else {
    els.userAvatar?.classList.add("hidden");
  }
}

function bindSteamButtonMirror(btn) {
  if (!btn) return;

  const updateMirror = (e) => {
    const rect = btn.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    btn.style.setProperty("--mirror-x", `${x}%`);
    btn.style.setProperty("--mirror-y", `${y}%`);
    btn.style.setProperty("--mirror-opacity", "1");
  };

  const clearMirror = () => {
    btn.style.setProperty("--mirror-opacity", "0");
  };

  btn.addEventListener("mouseenter", updateMirror);
  btn.addEventListener("mousemove", updateMirror);
  btn.addEventListener("mouseleave", clearMirror);
}

function bindByeUi() {
  if (byeUiBound) return;
  byeUiBound = true;

  getAuthEls().btnByeGiveUp?.addEventListener("click", () => {
    showWelcome({ openDialog: false });
  });
}

function bindWelcomeUi() {
  const els = getAuthEls();

  bindSteamButtonMirror(els.btnSteamLogin);

  els.btnWelcomeSignIn?.addEventListener("click", () => {
    openAuthDialog(DEFAULT_AUTH);
  });

  els.btnAuthClose?.addEventListener("click", () => {
    closeAuthDialog();
  });

  els.gate?.addEventListener("click", (e) => {
    if (e.target === els.gate) {
      closeAuthDialog();
    }
  });

  els.gate?.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeAuthDialog();
  });
}

export async function initAuth() {
  const els = getAuthEls();
  const authResult = getAuthErrorFromUrl();
  clearAuthQuery();

  bindWelcomeUi();
  bindByeUi();

  if (authResult?.type === "forbidden") {
    showBye();
    return { ok: false, reason: "forbidden" };
  }

  showAuthPending();

  els.btnLogout?.addEventListener("click", async () => {
    setStoredAuthSession(false);
    await logout();
    window.location.reload();
  });

  try {
    const user = await fetchCurrentUser();
    if (!user) {
      setStoredAuthSession(false);
      if (
        !document.documentElement.classList.contains("welcome-boot") &&
        !document.documentElement.classList.contains("bye-boot")
      ) {
        showWelcome({ openDialog: false });
      }
      if (authResult?.type === "error") {
        openAuthDialog({
          ...DEFAULT_AUTH,
          message: authResult.message,
        });
      }
      return { ok: false, reason: "unauthenticated" };
    }

    showApp(user);
    return { ok: true, user };
  } catch (error) {
    console.error(error);
    showWelcome({ openDialog: false });
    openAuthDialog({
      title: "Authentication unavailable",
      message:
        "Could not reach the auth API. Run the site with Cloudflare Pages (`npm run dev`) instead of a plain static server.",
      showLogin: false,
    });
    return { ok: false, reason: "offline" };
  }
}

export async function loadMapMarkers(mapId) {
  const response = await fetch(`/api/pins?mapId=${encodeURIComponent(mapId)}`, {
    credentials: "same-origin",
  });
  if (response.status === 401) {
    showWelcome({
      openDialog: true,
      dialogContent: {
        title: DEFAULT_AUTH.title,
        message: DEFAULT_AUTH.message,
        showLogin: true,
      },
    });
    throw new Error("unauthenticated");
  }
  if (response.status === 403) {
    showWelcome({
      openDialog: true,
      dialogContent: {
        title: "Access not granted",
        message:
          "You signed in with Steam, but your account is not on the member list yet. Ask an admin to add your Steam ID to the users list.",
        showLogin: false,
      },
    });
    throw new Error("forbidden");
  }
  const data = await response.json().catch(() => ({}));
  if (response.status === 503 && data.error) {
    openAuthDialog({
      title: "Map data unavailable",
      message: data.error,
      showLogin: false,
    });
    throw new Error(data.error);
  }
  if (response.status === 429) {
    const message = data.error || "Map loading limit reached. Try again shortly.";
    notifyRateLimited(message);
    throw new Error(message);
  }
  if (!response.ok) {
    const message = data.error || `Failed to load map markers (${response.status})`;
    console.error(message);
    throw new Error(message);
  }
  return data;
}
