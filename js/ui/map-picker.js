import { state } from "../state.js";

const LIST_TRANSITION_MS = 350;

let rootEl = null;
let onChangeCallback = null;
let eventsBound = false;
let closeTimer = null;

function getMapName(mapId) {
  return state.mapCatalog.find((map) => map.id === mapId)?.name || mapId;
}

function getListWrap() {
  return rootEl?.querySelector(".map-picker__list-wrap");
}

function measureOpenHeight() {
  const wrap = getListWrap();
  if (!wrap || !rootEl) return 0;

  const itemHeight = wrap.querySelector(".map-picker__option")?.offsetHeight || 33;
  const visibleCount = parseFloat(getComputedStyle(rootEl).getPropertyValue("--map-picker-visible-count")) || 8;
  return Math.min(wrap.scrollHeight, itemHeight * visibleCount);
}

function finishClose(onClosed) {
  if (!rootEl) return;
  rootEl.classList.remove("is-closing");
  rootEl.style.minHeight = "";
  const wrap = getListWrap();
  if (wrap) wrap.style.maxHeight = "";
  rootEl.querySelector(".map-picker__chevron")?.setAttribute("aria-expanded", "false");
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  onClosed?.();
}

function closePicker(onClosed) {
  if (!rootEl) return;
  if (!rootEl.classList.contains("is-open")) {
    onClosed?.();
    return;
  }
  if (rootEl.classList.contains("is-closing")) return;

  const wrap = getListWrap();
  if (!wrap) {
    finishClose(onClosed);
    return;
  }

  rootEl.classList.add("is-closing");
  rootEl.classList.remove("is-open");
  rootEl.style.minHeight = `${rootEl.offsetHeight}px`;
  wrap.style.maxHeight = `${wrap.offsetHeight}px`;

  requestAnimationFrame(() => {
    wrap.style.maxHeight = "0px";
  });

  const onTransitionEnd = (event) => {
    if (event.target !== wrap || event.propertyName !== "max-height") return;
    wrap.removeEventListener("transitionend", onTransitionEnd);
    finishClose(onClosed);
  };
  wrap.addEventListener("transitionend", onTransitionEnd);
  closeTimer = setTimeout(() => {
    wrap.removeEventListener("transitionend", onTransitionEnd);
    finishClose(onClosed);
  }, LIST_TRANSITION_MS + 50);
}

function openPicker() {
  if (!rootEl || rootEl.classList.contains("is-open") || rootEl.classList.contains("is-closing")) return;

  const wrap = getListWrap();
  if (!wrap) return;

  rootEl.style.minHeight = `${rootEl.offsetHeight}px`;
  rootEl.classList.add("is-open");
  rootEl.querySelector(".map-picker__chevron")?.setAttribute("aria-expanded", "true");

  const targetHeight = measureOpenHeight();
  wrap.style.maxHeight = "0px";

  requestAnimationFrame(() => {
    wrap.style.maxHeight = `${targetHeight}px`;
  });

  const onTransitionEnd = (event) => {
    if (event.target !== wrap || event.propertyName !== "max-height") return;
    wrap.removeEventListener("transitionend", onTransitionEnd);
    rootEl.style.minHeight = "";
    wrap.style.maxHeight = `${targetHeight}px`;
    const selected = rootEl.querySelector(".map-picker__option.is-selected");
    selected?.scrollIntoView({ block: "nearest" });
  };
  wrap.addEventListener("transitionend", onTransitionEnd);
}

function togglePicker() {
  if (!rootEl) return;
  if (rootEl.classList.contains("is-open")) closePicker();
  else openPicker();
}

function selectMap(mapId) {
  closePicker(() => {
    setMapPickerValue(mapId);
    if (mapId !== state.currentMapId) onChangeCallback?.(mapId);
  });
}

function bindEvents() {
  if (!rootEl || eventsBound) return;
  eventsBound = true;

  const chevron = rootEl.querySelector(".map-picker__chevron");
  const summary = rootEl.querySelector(".map-picker__summary");

  chevron?.addEventListener("click", (event) => {
    event.stopPropagation();
    togglePicker();
  });

  summary?.addEventListener("click", () => openPicker());
  summary?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  });

  document.addEventListener("click", (event) => {
    if (!rootEl?.contains(event.target)) closePicker();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePicker();
  });
}

export function setMapPickerValue(mapId) {
  if (!rootEl) rootEl = document.getElementById("map-select");
  if (!rootEl) return;

  const label = rootEl.querySelector(".map-picker__label");
  if (label) label.textContent = getMapName(mapId);

  rootEl.querySelectorAll(".map-picker__option").forEach((option) => {
    const isSelected = option.dataset.value === mapId;
    option.classList.toggle("is-selected", isSelected);
    option.setAttribute("aria-selected", isSelected ? "true" : "false");
  });
}

export function populateMapSelect() {
  rootEl = document.getElementById("map-select");
  if (!rootEl) return;

  const listEl = rootEl.querySelector(".map-picker__list");
  listEl.innerHTML = "";

  for (const map of state.mapCatalog) {
    const option = document.createElement("li");
    option.className = "map-picker__option";
    option.role = "option";
    option.dataset.value = map.id;
    option.textContent = map.name;
    option.setAttribute("aria-selected", map.id === state.currentMapId ? "true" : "false");
    if (map.id === state.currentMapId) option.classList.add("is-selected");
    option.addEventListener("click", () => selectMap(map.id));
    listEl.appendChild(option);
  }

  setMapPickerValue(state.currentMapId);
}

export function initMapPicker(onChange) {
  onChangeCallback = onChange;
  rootEl = document.getElementById("map-select");
  bindEvents();
}
