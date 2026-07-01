import { state } from "../state.js";

export function populateMapSelect() {
  const mapSelect = document.getElementById("map-select");
  mapSelect.innerHTML = "";
  for (const map of state.mapCatalog) {
    const option = document.createElement("option");
    option.value = map.id;
    option.textContent = map.name;
    mapSelect.appendChild(option);
  }
  mapSelect.value = state.currentMapId;
}

export function initMapPicker(onChange) {
  const mapSelect = document.getElementById("map-select");
  mapSelect.addEventListener("change", (event) => {
    onChange(event.target.value);
  });
}
