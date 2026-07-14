import { getSecurityConfig } from "./security-config.js";

const AUDIT_KEY = "audit:log";
const memoryAuditLog = [];

async function readEvents(env) {
  if (env.PINS_KV) {
    const stored = await env.PINS_KV.get(AUDIT_KEY, "json");
    return Array.isArray(stored) ? stored : [];
  }
  return memoryAuditLog;
}

async function writeEvents(env, events) {
  if (env.PINS_KV) {
    await env.PINS_KV.put(AUDIT_KEY, JSON.stringify(events));
    return;
  }
  memoryAuditLog.length = 0;
  memoryAuditLog.push(...events);
}

export async function appendAuditEvent(env, event) {
  const config = getSecurityConfig(env);
  if (!config.auditEnabled) return;

  const events = await readEvents(env);
  events.push({
    ts: new Date().toISOString(),
    ...event,
  });

  const max = config.auditMaxEvents;
  while (events.length > max) {
    events.shift();
  }

  await writeEvents(env, events);
}

export async function getRecentAuditEvents(env, limit = 100) {
  const events = await readEvents(env);
  return events.slice(-limit).reverse();
}
