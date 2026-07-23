export function emptyEventComponents() {
  return {
    stratIds: [],
    routePlanIds: [],
    whiteboardIds: [],
    rosterId: null,
  };
}

export const COMPONENT_KINDS = {
  strat: {
    label: "Strat",
    plural: "Strats",
    href: (id) => `/strats/${id}`,
    fetchPath: (id) => `/strats/${id}`,
    pickTitle: (body) => body?.strat?.title,
    fallbackTitle: "Untitled strat",
  },
  routePlan: {
    label: "Route plan",
    plural: "Route plans",
    href: (id) => `/routeplanner/${id}`,
    fetchPath: (id) => `/route-plans/${id}`,
    pickTitle: (body) => body?.plan?.title,
    fallbackTitle: "Untitled route plan",
  },
  whiteboard: {
    label: "Whiteboard",
    plural: "Whiteboards",
    href: (id) => `/micro-prep/${id}`,
    fetchPath: (id) => `/whiteboards/${id}`,
    pickTitle: (body) => body?.whiteboard?.title,
    fallbackTitle: "Untitled whiteboard",
  },
  roster: {
    label: "Roster",
    plural: "Roster",
    href: () => "/management",
    fetchPath: (id) => `/rosters/${id}`,
    pickTitle: (body) => body?.roster?.name,
    fallbackTitle: "Linked roster",
  },
};

const TYPE_LABELS = {
  scrim: "Scrim",
  comp: "Comp",
  practice: "Practice",
  other: "Other",
};

export function eventTypeLabel(eventType) {
  return TYPE_LABELS[eventType] || eventType || "Event";
}

export function normalizeEventComponents(components) {
  return {
    stratIds: [],
    routePlanIds: [],
    whiteboardIds: [],
    rosterId: null,
    ...(components || emptyEventComponents()),
  };
}

/** Flat list of linked component slots for resolution + render. */
export function listEventComponentSlots(components) {
  const normalized = normalizeEventComponents(components);
  const slots = [];

  for (const id of normalized.stratIds) {
    slots.push({ kind: "strat", id });
  }
  for (const id of normalized.routePlanIds) {
    slots.push({ kind: "routePlan", id });
  }
  for (const id of normalized.whiteboardIds) {
    slots.push({ kind: "whiteboard", id });
  }
  if (normalized.rosterId) {
    slots.push({ kind: "roster", id: normalized.rosterId });
  }
  return slots;
}

export function hasLinkedComponents(components) {
  return listEventComponentSlots(components).length > 0;
}

/** Schedule sidebar: linked tool kinds with counts (strats, routes, whiteboards only). */
export const SCHEDULE_COMPONENT_KINDS = [
  {
    kind: "strat",
    idsKey: "stratIds",
    icon: "fa-chess",
    label: "Strat",
    plural: "Strats",
    chipClass: "border-accent/25 bg-accent/10 text-accent",
  },
  {
    kind: "routePlan",
    idsKey: "routePlanIds",
    icon: "fa-route",
    label: "Route plan",
    plural: "Route plans",
    chipClass: "border-sky-400/25 bg-sky-400/10 text-sky-200",
  },
  {
    kind: "whiteboard",
    idsKey: "whiteboardIds",
    icon: "fa-chalkboard",
    label: "Whiteboard",
    plural: "Whiteboards",
    chipClass: "border-violet-400/25 bg-violet-400/10 text-violet-200",
  },
];

export function eventScheduleComponentBadges(components) {
  const normalized = normalizeEventComponents(components);

  return SCHEDULE_COMPONENT_KINDS.flatMap((def) => {
    const count = normalized[def.idsKey]?.length || 0;
    if (!count) return [];

    const noun = count === 1 ? def.label.toLowerCase() : def.plural.toLowerCase();
    return [
      {
        kind: def.kind,
        count,
        icon: def.icon,
        chipClass: def.chipClass,
        title: `${count} ${noun} linked`,
      },
    ];
  });
}

export function groupSlotsByKind(slots) {
  const groups = {
    strat: [],
    routePlan: [],
    whiteboard: [],
    roster: [],
  };
  for (const slot of slots) {
    groups[slot.kind]?.push(slot);
  }
  return groups;
}

/** Map API/client errors to brief UI status (never throw). */
export function resolveComponentStatus(error) {
  const status = error?.status;
  if (status === 404) return "missing";
  if (status === 403) return "restricted";
  if (status === 401) return "restricted";
  return "error";
}

export function componentStatusLabel(status) {
  switch (status) {
    case "missing":
      return "Missing — asset was deleted or is unavailable";
    case "restricted":
      return "Linked — details require Comp Admin access";
    case "error":
      return "Could not load link";
    case "loading":
      return "Loading…";
    default:
      return "";
  }
}

export function formatEventSchedule(event) {
  if (!event?.startsAt) return "";
  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;
  const dateFmt = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const date = dateFmt.format(start);
  const startTime = timeFmt.format(start);
  if (!end || Number.isNaN(end.getTime())) {
    return `${date} · ${startTime}`;
  }
  return `${date} · ${startTime} – ${timeFmt.format(end)}`;
}
