/** Default kernel page images for micro-prep whiteboard / slideshow. */

export const MICRO_PREP_SCENE_VERSION = 2;

export function defaultPageUrl(theme = "dark", slideshow = false) {
  if (slideshow) {
    return theme === "light"
      ? "/assets/micro-prep/page-slideshow-light.svg"
      : "/assets/micro-prep/page-slideshow-dark.svg";
  }
  return theme === "light"
    ? "/assets/micro-prep/page-square-light.svg"
    : "/assets/micro-prep/page-square-dark.svg";
}

export function emptyWhiteboardScene(theme = "dark") {
  return {
    sceneVersion: MICRO_PREP_SCENE_VERSION,
    objects: [],
    appState: { theme },
    pageUrl: null,
  };
}

export function normalizeWhiteboardScene(scene, theme = "dark") {
  if (!scene || scene.sceneVersion !== MICRO_PREP_SCENE_VERSION) {
    return emptyWhiteboardScene(theme);
  }
  return {
    sceneVersion: MICRO_PREP_SCENE_VERSION,
    objects: Array.isArray(scene.objects) ? scene.objects : [],
    appState: { theme, ...(scene.appState || {}) },
    pageUrl: scene.pageUrl || null,
  };
}
