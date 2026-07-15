import { state } from "../state.js";

const REQUIRES_FACTION_CONFIG = {
  axis: { label: "Gate", icon: "fa-archway" },
  allies: { label: "Hedgehog", icon: "fa-maximize" },
};

function getRequiresOptions() {
  return document.getElementById("pin-requires-options");
}

function getPinTitle() {
  return document.getElementById("pin-title");
}

function getPinDescription() {
  return document.getElementById("pin-description");
}

function getBtnDeletePin() {
  return document.getElementById("btn-delete-pin");
}

function initRequiresCheckboxes() {
  const requiresOptions = getRequiresOptions();
  if (!requiresOptions) return;
  requiresOptions.querySelectorAll(".requires-checkbox").forEach((label) => {
    const checkbox = label.querySelector('input[type="checkbox"]');
    if (!checkbox) return;
    checkbox.addEventListener("change", () => {
      label.classList.toggle("is-checked", checkbox.checked);
      scheduleAutoSave();
    });
    label.addEventListener("click", (event) => {
      event.preventDefault();
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event("change"));
    });
  });
}

function scheduleAutoSave() {
}

function initAutoSave(deps) {
  state.autoSaveDeps = deps;
}

function updateFactionRequires(faction) {
  const requiresFactionCheckbox = document.querySelector(".requires-checkbox--faction");
  if (!requiresFactionCheckbox) return;
  if (faction === "neutral") {
    requiresFactionCheckbox.classList.add("hidden");
    return;
  }
  const config = REQUIRES_FACTION_CONFIG[faction];
  if (config) {
    const label = document.getElementById("requires-faction-label");
    const icon = document.getElementById("requires-faction-icon");
    if (label) label.textContent = config.label;
    if (icon) icon.className = `fa-solid ${config.icon}`;
    requiresFactionCheckbox.classList.remove("hidden");
  } else {
    requiresFactionCheckbox.classList.add("hidden");
  }
}

function getRequiresData() {
  const requires = {};
  const requiresOptions = getRequiresOptions();
  if (!requiresOptions) return {};
  requiresOptions.querySelectorAll(".requires-checkbox").forEach((label) => {
    const checkbox = label.querySelector('input[type="checkbox"]');
    const requiresKey = label.dataset.requires;
    if (checkbox && checkbox.checked) {
      if (requiresKey === "faction-specific") {
        requires["faction-specific"] = state.pendingFaction;
      } else {
        requires[requiresKey] = true;
      }
    }
  });
  return requires;
}

function setRequiresData(requires) {
  const requiresOptions = getRequiresOptions();
  if (!requiresOptions) return;
  requiresOptions.querySelectorAll(".requires-checkbox").forEach((label) => {
    const checkbox = label.querySelector('input[type="checkbox"]');
    const requiresKey = label.dataset.requires;
    if (!checkbox) return;
    let isChecked = false;
    if (requiresKey === "faction-specific") {
      isChecked = Boolean(requires && requires["faction-specific"]);
    } else {
      isChecked = Boolean(requires && requires[requiresKey]);
    }
    checkbox.checked = isChecked;
    label.classList.toggle("is-checked", isChecked);
  });
}

function resetRequires() {
  const requiresOptions = getRequiresOptions();
  if (!requiresOptions) return;
  requiresOptions.querySelectorAll(".requires-checkbox").forEach((label) => {
    const checkbox = label.querySelector('input[type="checkbox"]');
    if (!checkbox) return;
    checkbox.checked = false;
    label.classList.remove("is-checked");
  });
}

export {
  getRequiresOptions,
  getPinTitle,
  getPinDescription,
  getBtnDeletePin,
  initRequiresCheckboxes,
  scheduleAutoSave,
  initAutoSave,
  updateFactionRequires,
  getRequiresData,
  setRequiresData,
  resetRequires,
};
