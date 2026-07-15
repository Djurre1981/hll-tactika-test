import { fetchCurrentUser, logout } from "../api/auth.js";
import { state } from "../state.js";
import {
  bindDashboardUi,
  bindToolChromeNav,
} from "./dashboard.js";
import { go, ROUTES } from "./router.js";
import {
  loadWelcomeScrub,
  startTypewriter,
  showWelcome,
  hideWelcome,
  showBye,
  hideBye,
} from "./auth-animations.js";
import {
  establishSession,
  showDashboard,
  enterApp,
  returnToDashboard,
  consumeHomeNotice,
} from "./auth-dashboard.js";

export const DEFAULT_AUTH = {
  title: "CIRCLE COMP LOGIN",
  message:
    "Sign in with your Hell Let Loose Steam account to access the platform. Only approved Circle members can have access.",
};

const AUTH_CLOSE_MS = 500;
export const AUTH_BOOT_KEY = "hll-tactika-authed";
let byeUiBound = false;

export function setStoredAuthSession(active) {
  try {
    if (active) localStorage.setItem(AUTH_BOOT_KEY, "1");
    else localStorage.removeItem(AUTH_BOOT_KEY);
  } catch {}
}

export function getAuthEls() {
  return {
    welcomePage: document.getElementById("welcome-page"),
    byePage: document.getElementById("bye-page"),
    byeActions: document.getElementById("bye-actions"),
    btnByeGiveUp: document.getElementById("btn-bye-give-up"),
    appRoot: document.getElementById("app-root"),
    modeSwitch: document.getElementById("mode-switch"),
    hubChrome: document.getElementById("hub-chrome"),
    dashboardPage: document.getElementById("dashboard-page"),
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

export function applyToolChrome(tool) {
  const modeSwitch = document.getElementById("mode-switch");
  const stratsTab = modeSwitch?.querySelector('[data-mode="strats"]');
  state.toolRoute = tool;
  if (tool === "stratmaker") {
    modeSwitch?.classList.add("hidden");
    stratsTab?.classList.add("hidden");
    return;
  }
  if (tool === "climbing-guide") {
    stratsTab?.classList.add("hidden");
  }
}

export function applyUserCluster(user) {
  const els = getAuthEls();
  const label = user.name || `Steam user ${user.steamId}`;
  if (els.userName) els.userName.textContent = label;
  if (user.avatar) {
    if (els.userAvatar) {
      els.userAvatar.src = user.avatar;
      els.userAvatar.alt = label;
      els.userAvatar.classList.remove("hidden");
    }
  } else {
    els.userAvatar?.classList.add("hidden");
  }
  els.userCluster?.classList.remove("hidden");
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

export function openAuthDialog(content) {
  const els = getAuthEls();
  if (!els.gate) return;
  setAuthDialogContent(content);
  els.gate.classList.remove("is-closing");
  if (!els.gate.open) {
    els.gate.showModal();
  }
}

export function closeAuthDialog() {
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

export function clearAuthPending() {
  getAuthEls().appRoot?.classList.remove("is-auth-pending");
}

function showAuthPending() {
  const els = getAuthEls();
  const maybeAuthed = (() => {
    try {
      return localStorage.getItem(AUTH_BOOT_KEY) === "1";
    } catch {
      return false;
    }
  })();

  els.byePage?.classList.add("is-hidden");
  els.appRoot?.classList.add("hidden", "is-auth-pending");
  els.modeSwitch?.classList.add("hidden");
  els.userCluster?.classList.add("hidden");

  if (maybeAuthed) {
    document.documentElement.classList.remove("welcome-boot", "bye-boot", "app-boot");
    document.documentElement.classList.add("dashboard-boot");
    els.welcomePage?.classList.add("is-hidden");
    els.dashboardPage?.classList.remove("hidden");
    els.hubChrome?.classList.remove("hidden");
    const greeting = document.getElementById("dashboard-greeting");
    if (greeting) greeting.textContent = "Welcome back";
    return;
  }

  document.documentElement.classList.remove("app-boot", "bye-boot", "dashboard-boot");
  document.documentElement.classList.add("welcome-boot");
  els.welcomePage?.classList.remove("is-hidden");
  els.hubChrome?.classList.add("hidden");
  els.dashboardPage?.classList.add("hidden");

  void loadWelcomeScrub().then(({ initWelcomeScrub }) => {
    if (els.scrubVideo) {
      els.scrubVideo.__welcomeScrub = initWelcomeScrub(els.scrubVideo);
    }
  });

  startTypewriter();
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

function bindLogout() {
  getAuthEls().btnLogout?.addEventListener("click", async () => {
    setStoredAuthSession(false);
    await logout();
    go(ROUTES.HOME, { replace: true });
  });
}

export async function initHomeAuth() {
  const authResult = getAuthErrorFromUrl();
  clearAuthQuery();

  bindWelcomeUi();
  bindByeUi();
  bindLogout();

  if (authResult?.type === "forbidden") {
    showBye();
    return { ok: false, reason: "forbidden" };
  }

  showAuthPending();

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

    bindDashboardUi();
    showDashboard(user);
    consumeHomeNotice();
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

export async function initToolAuth({ tool, enterMode }) {
  bindLogout();
  bindToolChromeNav();

  try {
    const user = await fetchCurrentUser();
    if (!user) {
      setStoredAuthSession(false);
      go(ROUTES.HOME, { replace: true });
      return { ok: false, reason: "unauthenticated" };
    }

    if (tool === "stratmaker" && user.role === "viewer") {
      go(`${ROUTES.HOME}?notice=stratmaker-locked`, { replace: true });
      return { ok: false, reason: "forbidden-role" };
    }

    establishSession(user);
    state.toolRoute = tool;
    enterApp(enterMode);
    return { ok: true, user };
  } catch (error) {
    console.error(error);
    go(ROUTES.HOME, { replace: true });
    return { ok: false, reason: "offline" };
  }
}

export async function initAuth() {
  return initHomeAuth();
}

export async function loadMapMarkers(mapId) {
  const response = await fetch(`/api/pins?mapId=${encodeURIComponent(mapId)}`, {
    credentials: "same-origin",
  });
  if (response.status === 401) {
    setStoredAuthSession(false);
    go(ROUTES.HOME, { replace: true });
    throw new Error("unauthenticated");
  }
  if (response.status === 403) {
    setStoredAuthSession(false);
    go(`${ROUTES.HOME}?auth=forbidden`, { replace: true });
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
  if (!response.ok) {
    const message = data.error || `Failed to load map markers (${response.status})`;
    console.error(message);
    throw new Error(message);
  }
  return data;
}
