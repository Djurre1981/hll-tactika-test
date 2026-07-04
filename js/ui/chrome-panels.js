export function isPortraitLayout() {
  return window.matchMedia("(orientation: portrait)").matches;
}

export function setShellCollapsed(shell, toggle, collapsed, labels) {
  if (!shell) return;
  shell.classList.toggle("is-collapsed", collapsed);
  if (!toggle) return;
  toggle.setAttribute("aria-expanded", String(!collapsed));
  toggle.setAttribute("aria-label", collapsed ? labels.show : labels.hide);
  toggle.title = collapsed ? labels.show : labels.hide;
}

export function initPortraitPanelDefaults() {
  if (!isPortraitLayout()) return;

  setShellCollapsed(
    document.getElementById("sidebar-shell"),
    document.getElementById("btn-sidebar-toggle"),
    true,
    { show: "Show sidebar", hide: "Hide sidebar" }
  );
  setShellCollapsed(
    document.getElementById("map-toolbar-shell"),
    document.getElementById("btn-map-toolbar-toggle"),
    true,
    { show: "Show toolbar", hide: "Hide toolbar" }
  );
}
