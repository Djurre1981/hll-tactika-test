import { sanitizeStratObjects } from "./strat-objects.js";

export const STRAT_TEAMS = ["jr", "sr"];
export const STRAT_TYPES = ["friendly", "tournament"];

export function normalizeStratTeam(value) {
  return STRAT_TEAMS.includes(value) ? value : "jr";
}

export function normalizeStratType(value) {
  return STRAT_TYPES.includes(value) ? value : "friendly";
}

export function normalizeStratTitle(value) {
  const title = String(value || "").trim();
  return title || "Untitled Strat";
}

export function normalizeSlideName(value) {
  const name = String(value || "").trim();
  return name || "Untitled";
}

function normalizeSlide(slide, index) {
  if (!slide || typeof slide !== "object") {
    return null;
  }

  const id = String(slide.id || "").trim();
  const mapId = String(slide.mapId || "").trim();
  if (!id || !mapId) {
    return null;
  }

  return {
    id,
    name: normalizeSlideName(slide.name),
    order: Number.isFinite(Number(slide.order)) ? Number(slide.order) : index,
    mapId,
    objects: sanitizeStratObjects(slide.objects),
  };
}

export function sanitizeStratInput(strat, { requireSlides = true } = {}) {
  if (!strat || typeof strat !== "object") {
    return { error: "Invalid strat payload" };
  }

  const title = normalizeStratTitle(strat.title);
  const team = normalizeStratTeam(strat.tags?.team);
  const type = normalizeStratType(strat.tags?.type);
  const notes = String(strat.notes || "").trim();

  const rawSlides = Array.isArray(strat.slides) ? strat.slides : [];
  const slides = rawSlides
    .map((slide, index) => normalizeSlide(slide, index))
    .filter(Boolean)
    .sort((a, b) => a.order - b.order)
    .map((slide, index) => ({ ...slide, order: index }));

  if (requireSlides && slides.length === 0) {
    return { error: "At least one slide is required" };
  }

  return {
    strat: {
      title,
      tags: { team, type },
      notes,
      slides,
      locked: Boolean(strat.locked),
      lockedBy: strat.locked ? String(strat.lockedBy || "").trim() || null : null,
    },
  };
}

export function applyStratUpdates(existing, updates) {
  const merged = {
    ...existing,
    ...updates,
    tags: {
      team: normalizeStratTeam(updates.tags?.team ?? existing.tags?.team),
      type: normalizeStratType(updates.tags?.type ?? existing.tags?.type),
    },
  };

  if (updates.title !== undefined) {
    merged.title = normalizeStratTitle(updates.title);
  }
  if (updates.notes !== undefined) {
    merged.notes = String(updates.notes || "").trim();
  }
  if (Array.isArray(updates.slides)) {
    const sanitized = sanitizeStratInput({ ...merged, slides: updates.slides }, { requireSlides: true });
    if (sanitized.error) {
      return sanitized;
    }
    merged.slides = sanitized.strat.slides;
  }

  if (updates.locked !== undefined) {
    merged.locked = Boolean(updates.locked);
    merged.lockedBy = merged.locked ? String(updates.lockedBy || existing.lockedBy || "").trim() || null : null;
  }

  return { strat: merged };
}
