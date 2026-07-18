/** Slideshow scene helpers for Excalidraw-backed micro-prep boards. */

export function sortSlides(slides) {
  return [...(slides || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function emptySlide(order = 0, name) {
  return {
    id: `slide-${crypto.randomUUID()}`,
    name: name || `Slide ${order + 1}`,
    order,
    elements: [],
    appState: { theme: "dark" },
    files: {},
  };
}

export function ensureSlideshowScene(scene) {
  const slides = sortSlides(scene?.slides);
  if (slides.length > 0) {
    return { slides };
  }
  return { slides: [emptySlide(0, "Slide 1")] };
}

export function slideToExcalidrawScene(slide, theme = "dark") {
  return {
    elements: Array.isArray(slide?.elements) ? slide.elements : [],
    appState: {
      ...(slide?.appState || {}),
      // Chrome preference only — ExcalidrawCanvas forces light at runtime.
      theme,
    },
    files: slide?.files && typeof slide.files === "object" ? slide.files : {},
  };
}

export function captureSlideFromApi(api, theme = "dark") {
  if (!api) {
    return {
      elements: [],
      appState: { theme },
      files: {},
    };
  }
  const appState = api.getAppState?.() || {};
  return {
    elements: api.getSceneElements?.() || [],
    appState: {
      viewBackgroundColor: appState.viewBackgroundColor,
      gridSize: appState.gridSize,
      // Chrome theme for our shell — Excalidraw runtime theme stays light.
      theme,
      scrollX: appState.scrollX,
      scrollY: appState.scrollY,
      zoom: appState.zoom,
    },
    files: api.getFiles?.() || {},
  };
}

export function mergeActiveSlide(slides, activeSlideId, captured) {
  return sortSlides(slides).map((slide) =>
    slide.id === activeSlideId
      ? {
          ...slide,
          elements: captured.elements,
          appState: captured.appState,
          files: captured.files,
        }
      : slide
  );
}
