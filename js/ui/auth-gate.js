import { fetchCurrentUser, logout, setCurrentUser } from "../api/auth.js";
import { initWelcomeTypewriter } from "./welcome-typewriter.js";

const DEFAULT_AUTH = {
  title: "CIRCLE COMP LOGIN",
  message:
    "Sign in with your Hell Let Loose Steam account to access the platform. Only approved Circle members can have access.",
};

const AUTH_CLOSE_MS = 500;
const AUTH_BOOT_KEY = "hll_authed";
const WELCOME_SCRUB_MODULE = new URL("./welcome-scrub.js", import.meta.url);

function hasStoredAuthSession() {
  try {
    return localStorage.getItem(AUTH_BOOT_KEY) === "1";
  } catch {
    return false;
  }
}

function setStoredAuthSession(active) {
  try {
    if (active) localStorage.setItem(AUTH_BOOT_KEY, "1");
    else localStorage.removeItem(AUTH_BOOT_KEY);
  } catch {}
}

let scrubController = null;
let typewriterController = null;

function getAuthEls() {
  return {
    welcomePage: document.getElementById("welcome-page"),
    appHeader: document.getElementById("app-header"),
    gate: document.getElementById("auth-gate"),
    gateTitle: document.getElementById("auth-gate-title"),
    gateMessage: document.getElementById("auth-gate-message"),
    btnSteamLogin: document.getElementById("btn-steam-login"),
    btnWelcomeSignIn: document.getElementById("btn-welcome-sign-in"),
    btnAuthClose: document.getElementById("btn-auth-close"),
    headerUser: document.getElementById("header-user"),
    userAvatar: document.getElementById("user-avatar"),
    userName: document.getElementById("user-name"),
    btnLogout: document.getElementById("btn-logout"),
    appRoot: document.getElementById("app-root"),
    scrubVideo: document.getElementById("welcome-scrub-video"),
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
    return `Your Steam account is not on the member list yet.${idHint}`;
  }
  if (auth === "error") {
    return "Steam sign-in failed. Please try again.";
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

function showWelcome({ openDialog = false, dialogContent = DEFAULT_AUTH } = {}) {
  const els = getAuthEls();
  setStoredAuthSession(false);
  document.documentElement.classList.remove("app-boot");
  document.documentElement.classList.add("welcome-boot");
  els.welcomePage?.classList.remove("is-hidden");
  els.appHeader?.classList.add("hidden");
  els.appRoot?.classList.add("hidden");
  els.headerUser?.classList.add("hidden");
  document.getElementById("btn-toggle-edit")?.classList.add("hidden");
  document.getElementById("header-toolbar-sep")?.classList.add("hidden");

  scrubController = els.scrubVideo?.__welcomeScrub ?? null;
  if (els.scrubVideo && !scrubController) {
    void import(WELCOME_SCRUB_MODULE).then(({ initWelcomeScrub }) => {
      scrubController = initWelcomeScrub(els.scrubVideo);
    });
  }

  if (!typewriterController) {
    startTypewriter();
  }

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
  els.appHeader?.classList.remove("hidden");
  destroyWelcomeScrub();
  destroyTypewriter();
  closeAuthDialog();
}

function showApp(user) {
  const els = getAuthEls();
  setCurrentUser(user);
  setStoredAuthSession(true);
  hideWelcome();
  els.appRoot?.classList.remove("hidden");
  els.headerUser?.classList.remove("hidden");

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
  const authError = getAuthErrorFromUrl();
  clearAuthQuery();

  bindWelcomeUi();

  if (!hasStoredAuthSession()) {
    showWelcome({ openDialog: false });
  }

  els.btnLogout?.addEventListener("click", async () => {
    setStoredAuthSession(false);
    await logout();
    window.location.reload();
  });

  try {
    const user = await fetchCurrentUser();
    if (!user) {
      setStoredAuthSession(false);
      if (!document.documentElement.classList.contains("welcome-boot")) {
        showWelcome({ openDialog: false });
      }
      if (authError) {
        openAuthDialog({
          ...DEFAULT_AUTH,
          message: authError,
        });
      }
      return { ok: false, reason: "unauthenticated" };
    }

    showApp(user);
    return { ok: true, user };
  } catch (error) {
    console.error(error);
    openAuthDialog({
      title: "Authentication unavailable",
      message:
        "Could not reach the auth API. Run the site with Cloudflare Pages (`npm run dev`) instead of a plain static server.",
      showLogin: false,
    });
    return { ok: false, reason: "offline" };
  }
}

export async function loadProtectedPins() {
  const response = await fetch("/api/pins", { credentials: "same-origin" });
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
  if (!response.ok) {
    throw new Error("Failed to load protected pin data");
  }
  return response.json();
}
