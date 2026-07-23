import { requireDb } from "./d1.js";
import { assertEventEditable, getEvent, sanitizeEventComponents } from "./events-store.js";
import { getRoutePlan } from "./route-plans-store.js";

const COMPONENT_KEYS = {
  strat: "stratIds",
  routePlan: "routePlanIds",
  whiteboard: "whiteboardIds",
};

function parseComponentsJson(raw) {
  if (!raw) return sanitizeEventComponents(null);
  try {
    return sanitizeEventComponents(JSON.parse(raw));
  } catch {
    return sanitizeEventComponents(null);
  }
}

/** Find hub event id that lists this component id. */
export async function findEventIdForComponent(env, type, componentId) {
  const id = String(componentId || "").trim();
  const key = COMPONENT_KEYS[type];
  if (!id || !key) return null;

  const db = requireDb(env);
  const result = await db.prepare("SELECT id, components_json FROM events").all();

  for (const row of result.results || []) {
    const components = parseComponentsJson(row.components_json);
    if (components[key]?.includes(id)) {
      return row.id;
    }
  }

  return null;
}

export async function findEventIdForRoutePlan(env, planId) {
  const hubId = await findEventIdForComponent(env, "routePlan", planId);
  if (hubId) return hubId;

  const plan = await getRoutePlan(env, planId);
  const eventId = plan?.plan?.eventId;
  return eventId ? String(eventId).trim() || null : null;
}

export async function findEventIdForLinkedTool(env, type, toolId) {
  if (type === "routePlan") {
    return findEventIdForRoutePlan(env, toolId);
  }
  return findEventIdForComponent(env, type, toolId);
}

/** Returns 423 when a linked event is locked; ok when unlinked or editable. */
export async function assertLinkedEventEditable(env, type, toolId) {
  const eventId = await findEventIdForLinkedTool(env, type, toolId);
  if (!eventId) return { ok: true, eventId: null };

  const event = await getEvent(env, eventId);
  if (!event) return { ok: true, eventId };

  const editable = assertEventEditable(event);
  if (editable.error) {
    return { ...editable, eventId, event };
  }

  return { ok: true, eventId, event };
}
