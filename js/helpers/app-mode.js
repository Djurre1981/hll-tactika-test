import { state } from "../state.js";
import { canEnterEditorMode } from "./permissions.js";

export function isViewerAppMode() {
  return state.appMode === "viewer";
}

export function isEditorAppMode() {
  return state.appMode === "editor";
}

export function isStratsAppMode() {
  return state.appMode === "strats";
}

export function canEnterStratsMode() {
  return canEnterEditorMode();
}

export function isGuideInteractionAllowed() {
  return state.appMode !== "strats";
}
