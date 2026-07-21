/** Slideshow + whiteboard scene helpers for map-kernel micro-prep boards. */

import { MICRO_PREP_SCENE_VERSION, defaultPageUrl } from "./microPrepPages.js";

export function sortSlides(slides) {
  return [...(slides || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function emptySlide(order = 0, name, theme = "dark") {
  return {
    id: `slide-${crypto.randomUUID()}`,
    name: name || `Slide ${order + 1}`,
    order,
    objects: [],
    appState: { theme },
    pageUrl: null,
  };
}

export function ensureSlideshowScene(scene, theme = "dark") {
  if (scene?.sceneVersion === MICRO_PREP_SCENE_VERSION && Array.isArray(scene?.slides)) {
    const slides = sortSlides(scene.slides);
    if (slides.length > 0) return { slides, sceneVersion: MICRO_PREP_SCENE_VERSION };
  }
  return { slides: [emptySlide(0, "Slide 1", theme)], sceneVersion: MICRO_PREP_SCENE_VERSION };
}

export function slidePageUrl(slide, theme = "dark") {
  return slide?.pageUrl || defaultPageUrl(theme, true);
}

export function captureSlideFromKernel(kernel, theme = "dark") {
  if (!kernel) {
    return {
      objects: [],
      appState: { theme },
      pageUrl: null,
    };
  }
  return {
    objects: kernel.getObjects?.() || [],
    appState: { theme },
    pageUrl: kernel.getPageUrl?.() || null,
  };
}

export function mergeActiveSlide(slides, activeSlideId, captured) {
  return sortSlides(slides).map((slide) =>
    slide.id === activeSlideId
      ? {
          ...slide,
          objects: captured.objects,
          appState: captured.appState,
          pageUrl: captured.pageUrl,
        }
      : slide
  );
}

export function getSlideObjects(slide) {
  if (slide?.sceneVersion !== MICRO_PREP_SCENE_VERSION && !Array.isArray(slide?.objects)) {
    return [];
  }
  return Array.isArray(slide?.objects) ? slide.objects : [];
}
