import { state } from "../state.js";
import { setCurrentUser, getCurrentUser } from "../api/auth.js";
import { go, ROUTES } from "./router.js";
import { hideDashboardView, showDashboardView, populateDashboard, showComingSoon } from "./dashboard.js";
import {
  getAuthEls,
  applyToolChrome,
  applyUserCluster,
  clearAuthPending,
  setStoredAuthSession,
} from "./auth-gate.js";
import { hideBye, hideWelcome } from "./auth-animations.js";

function establishSession(user) {
  clearAuthPending();
  setCurrentUser(user);
  setStoredAuthSession(true);
  hideBye();
  hideWelcome();
  applyUserCluster(user);
}

function showDashboard(user) {
  const els = getAuthEls();
  establishSession(user);
  document.documentElement.classList.remove("app-boot", "welcome-boot", "bye-boot");
  document.documentElement.classList.add("dashboard-boot");
  els.appRoot?.classList.add("hidden");
  els.modeSwitch?.classList.add("hidden");
  state.toolRoute = null;
  populateDashboard(user);
  showDashboardView();
  document.title = "HLL-Tactika";
}

function enterApp(mode = "viewer") {
  const els = getAuthEls();
  const user = getCurrentUser();
  const tool = mode === "strats" ? "stratmaker" : "climbing-guide";
  hideDashboardView();
  document.documentElement.classList.remove("dashboard-boot", "welcome-boot", "bye-boot");
  document.documentElement.classList.add("app-boot");
  els.appRoot?.classList.remove("hidden");
  if (els.appRoot && !els.appRoot.hasAttribute("data-ready")) {
    els.appRoot.classList.add("is-auth-pending");
  }
  applyUserCluster(user || { name: els.userName?.textContent || "" });
  applyToolChrome(tool);
  if (tool === "stratmaker" || user?.role === "viewer") {
    els.modeSwitch?.classList.add("hidden");
  } else {
    els.modeSwitch?.classList.remove("hidden");
  }
  if (els.appRoot) els.appRoot.dataset.enterMode = mode;
  return mode;
}

async function returnToDashboard() {
  go(ROUTES.HOME);
}

function consumeHomeNotice() {
  const params = new URLSearchParams(window.location.search);
  const notice = params.get("notice");
  if (!notice) return;
  if (notice === "stratmaker-locked") {
    showComingSoon("Circle Stratmaker is not available for your role");
  }
  params.delete("notice");
  const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
  window.history.replaceState({}, "", next);
}

export {
  establishSession,
  showDashboard,
  enterApp,
  returnToDashboard,
  consumeHomeNotice,
};
