function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function clampMapPoint(point) {
  return {
    x: clamp(point.x, 0, 100),
    y: clamp(point.y, 0, 100),
  };
}

const modifierState = {
  shift: false,
  alt: false,
};

let onModifierChange = null;

function isModifierKey(event) {
  return event.key === "Shift" || event.key === "Alt";
}

function syncModifierFromEvent(event, pressed) {
  if (event.key === "Shift") modifierState.shift = pressed;
  if (event.key === "Alt") modifierState.alt = pressed;
}

export function getDrawModifiers(event = null) {
  return {
    shift: modifierState.shift || Boolean(event?.shiftKey),
    alt: modifierState.alt || Boolean(event?.altKey),
  };
}

export function bindDrawModifierTracking({ onChange } = {}) {
  onModifierChange = onChange;

  window.addEventListener("keydown", (event) => {
    if (!isModifierKey(event)) return;
    const before = { ...modifierState };
    syncModifierFromEvent(event, true);
    if (before.shift !== modifierState.shift || before.alt !== modifierState.alt) {
      onModifierChange?.(getDrawModifiers(event));
    }
  });

  window.addEventListener("keyup", (event) => {
    if (!isModifierKey(event)) return;
    const before = { ...modifierState };
    syncModifierFromEvent(event, false);
    if (before.shift !== modifierState.shift || before.alt !== modifierState.alt) {
      onModifierChange?.(getDrawModifiers(event));
    }
  });

  window.addEventListener("blur", () => {
    modifierState.shift = false;
    modifierState.alt = false;
    onModifierChange?.(getDrawModifiers());
  });
}

function constrainProportionalDelta(dx, dy, aspect) {
  const visualW = Math.abs(dx) * aspect;
  const visualH = Math.abs(dy);
  const visualSize = Math.max(visualW, visualH);
  return {
    dx: (visualSize * Math.sign(dx || 1)) / aspect,
    dy: visualSize * Math.sign(dy || 1),
  };
}

function constrainCornerProportional(start, end, aspect) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const { dx: nextDx, dy: nextDy } = constrainProportionalDelta(dx, dy, aspect);
  return clampMapPoint({
    x: start.x + nextDx,
    y: start.y + nextDy,
  });
}

function snapLineEnd(start, end, aspect) {
  const dx = (end.x - start.x) * aspect;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) return clampMapPoint(end);

  const angle = Math.atan2(dy, dx);
  const step = Math.PI / 4;
  const snapped = Math.round(angle / step) * step;

  return clampMapPoint({
    x: start.x + (Math.cos(snapped) * length) / aspect,
    y: start.y + Math.sin(snapped) * length,
  });
}

function resolveBoxPoints(anchor, cursor, aspect, modifiers, { proportional }) {
  const { shift, alt } = modifiers;

  if (alt) {
    let dx = cursor.x - anchor.x;
    let dy = cursor.y - anchor.y;
    if (shift && proportional) {
      ({ dx, dy } = constrainProportionalDelta(dx, dy, aspect));
    }
    return [
      clampMapPoint({ x: anchor.x - dx, y: anchor.y - dy }),
      clampMapPoint({ x: anchor.x + dx, y: anchor.y + dy }),
    ];
  }

  let end = cursor;
  if (shift && proportional) {
    end = constrainCornerProportional(anchor, cursor, aspect);
  }

  return [anchor, clampMapPoint(end)];
}

export function resolveTwoPointShape(type, anchor, cursor, aspect, modifiers) {
  if (type === "line" || type === "arrow") {
    const end = modifiers.shift ? snapLineEnd(anchor, cursor, aspect) : clampMapPoint(cursor);
    return [anchor, end];
  }

  if (type === "rect") {
    return resolveBoxPoints(anchor, cursor, aspect, modifiers, { proportional: true });
  }

  if (type === "ellipse") {
    return resolveBoxPoints(anchor, cursor, aspect, modifiers, { proportional: true });
  }

  return [anchor, clampMapPoint(cursor)];
}

export function constrainDragDelta(_startPoint, dx, dy, aspect, modifiers = {}) {
  const shift = modifiers.shift ?? false;
  if (!shift) {
    return { dx, dy };
  }

  const visualDx = dx * aspect;
  const visualDy = dy;
  if (Math.abs(visualDx) >= Math.abs(visualDy)) {
    return { dx, dy: 0 };
  }
  return { dx: 0, dy };
}

export function visualDistance(a, b, aspect) {
  const dx = (b.x - a.x) * aspect;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}
