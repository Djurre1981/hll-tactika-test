import { go, pathForMode, ROUTES } from "./router.js";

const HUB_TABS = ["dashboard", "strats", "management", "calendar"];

let toastTimer = null;
let enterResolve = null;
let enterPromise = null;
let pendingEnterMode = null;
let appBootstrapped = false;
let onEnterAppMode = null;
let bound = false;

function ensureEnterPromise() {
  if (appBootstrapped) return;
  if (!enterPromise) {
    enterPromise = new Promise((resolve) => {
      enterResolve = resolve;
    });
  }
}

function getEls() {
  return {
    page: document.getElementById("dashboard-page"),
    greeting: document.getElementById("dashboard-greeting"),
    hubChrome: document.getElementById("hub-chrome"),
    hubLogo: document.getElementById("hub-logo"),
    hubNav: document.getElementById("hub-nav"),
    toast: document.getElementById("dashboard-toast"),
    toolStratmaker: document.getElementById("tool-stratmaker"),
    toolClimb: document.getElementById("tool-climbing-guide"),
    btnDashboardHome: document.getElementById("btn-dashboard-home"),
    sidebarLogoHome: document.getElementById("sidebar-logo-home"),
  };
}

function setHubIndex(index) {
  const { hubNav } = getEls();
  if (!hubNav) return;
  hubNav.dataset.hubIndex = String(index);
  hubNav.querySelectorAll("[data-hub]").forEach((tab) => {
    const hub = tab.getAttribute("data-hub");
    const selected = HUB_TABS[index] === hub;
    tab.setAttribute("aria-selected", String(selected));
  });
}

export function showComingSoon(label = "Coming soon") {
  const { toast } = getEls();
  if (!toast) return;
  toast.textContent = label;
  toast.hidden = false;
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
    toastTimer = null;
  }, 2200);
}

export function syncDashboardRole(user) {
  const canStrats = user?.role && user.role !== "viewer";
  const { toolStratmaker } = getEls();

  if (toolStratmaker) {
    toolStratmaker.disabled = !canStrats;
    toolStratmaker.setAttribute("aria-disabled", String(!canStrats));
    toolStratmaker.classList.toggle("is-role-locked", !canStrats);
  }
}

export function populateDashboard(user) {
  const { greeting } = getEls();
  const name = user?.name || "Operator";
  if (greeting) greeting.textContent = `Welcome back, ${name}`;
  syncDashboardRole(user);
  setHubIndex(0);
}

export function showDashboardView() {
  const { page, hubChrome } = getEls();
  page?.classList.remove("hidden");
  hubChrome?.classList.remove("hidden");
  setHubIndex(0);
}

export function hideDashboardView() {
  const { page, hubChrome, toast } = getEls();
  page?.classList.add("hidden");
  hubChrome?.classList.add("hidden");
  if (toast) toast.hidden = true;
}

export function waitForEnterApp() {
  if (appBootstrapped) {
    return Promise.resolve(null);
  }
  if (pendingEnterMode) {
    const mode = pendingEnterMode;
    pendingEnterMode = null;
    return Promise.resolve(mode);
  }
  ensureEnterPromise();
  return enterPromise;
}

export function markAppBootstrapped() {
  appBootstrapped = true;
  pendingEnterMode = null;
  enterResolve = null;
  enterPromise = null;
}

export function setEnterAppModeHandler(handler) {
  onEnterAppMode = handler;
}

function requestEnter(mode) {
  if (appBootstrapped) {
    if (typeof onEnterAppMode === "function") {
      void onEnterAppMode(mode);
    }
    return;
  }
  ensureEnterPromise();
  if (enterResolve) {
    const resolve = enterResolve;
    enterResolve = null;
    pendingEnterMode = null;
    resolve(mode);
    return;
  }
  pendingEnterMode = mode;
}

export function resolveEnterApp(mode) {
  requestEnter(mode);
}

export function bindDashboardUi() {
  if (bound) return;
  bound = true;
  ensureEnterPromise();

  const els = getEls();

  els.hubLogo?.addEventListener("click", () => {
    go(ROUTES.HOME);
  });

  els.btnDashboardHome?.addEventListener("click", () => {
    go(ROUTES.HOME);
  });

  els.sidebarLogoHome?.addEventListener("click", () => {
    go(ROUTES.HOME);
  });

  els.hubNav?.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-hub]");
    if (!tab || tab.disabled || tab.getAttribute("aria-disabled") === "true") return;

    const hub = tab.getAttribute("data-hub");
    const index = HUB_TABS.indexOf(hub);
    if (index < 0) return;

    if (tab.hasAttribute("data-placeholder")) {
      setHubIndex(index);
      const labels = {
        strats: "My Strats — coming soon",
        management: "Management — coming soon",
        calendar: "Calendar — coming soon",
      };
      showComingSoon(labels[hub] || "Coming soon");
      window.setTimeout(() => setHubIndex(0), 480);
      return;
    }

    if (hub === "dashboard") {
      setHubIndex(0);
      go(ROUTES.HOME);
    }
  });

  document.getElementById("dashboard-page")?.addEventListener("click", (event) => {
    const tool = event.target.closest("[data-tool]");
    if (!tool || tool.disabled || tool.getAttribute("aria-disabled") === "true") return;

    if (tool.hasAttribute("data-placeholder")) {
      const toolId = tool.getAttribute("data-tool");
      const label =
        toolId === "micro-prep" ? "Micro Prep — coming soon" : "HLL Records — coming soon";
      showComingSoon(label);
      return;
    }

    const mode = tool.getAttribute("data-tool");
    if (mode === "viewer" || mode === "strats") {
      go(pathForMode(mode));
    }
  });
}

/** Bind dashboard/home links that exist on tool pages (no hub). */
export function bindToolChromeNav() {
  if (bound) return;
  bound = true;
  const els = getEls();
  els.btnDashboardHome?.addEventListener("click", () => {
    go(ROUTES.HOME);
  });
  els.sidebarLogoHome?.addEventListener("click", () => {
    go(ROUTES.HOME);
  });
}
