function rowToEvent(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    startsAt: row.starts_at,
    endsAt: row.ends_at || "",
    eventType: row.event_type,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function requireDb(env) {
  if (!env.DB) {
    throw new Error("D1 database binding DB is not configured");
  }
  return env.DB;
}

export async function listEvents(env, { from, to }) {
  const db = requireDb(env);
  const result = await db
    .prepare(
      `SELECT id, title, description, starts_at, ends_at, event_type, created_by, created_at, updated_at
       FROM events
       WHERE starts_at >= ? AND starts_at < ?
       ORDER BY starts_at ASC`
    )
    .bind(from, to)
    .all();

  return (result.results || []).map(rowToEvent);
}

export async function getEvent(env, eventId) {
  const db = requireDb(env);
  const row = await db
    .prepare(
      `SELECT id, title, description, starts_at, ends_at, event_type, created_by, created_at, updated_at
       FROM events
       WHERE id = ?`
    )
    .bind(eventId)
    .first();

  return row ? rowToEvent(row) : null;
}

export async function createEvent(env, event) {
  const db = requireDb(env);
  await db
    .prepare(
      `INSERT INTO events
       (id, title, description, starts_at, ends_at, event_type, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      event.id,
      event.title,
      event.description || null,
      event.startsAt,
      event.endsAt || null,
      event.eventType,
      event.createdBy,
      event.createdAt,
      event.updatedAt
    )
    .run();

  return getEvent(env, event.id);
}

export async function updateEvent(env, eventId, updates) {
  const existing = await getEvent(env, eventId);
  if (!existing) return null;

  const next = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const db = requireDb(env);
  await db
    .prepare(
      `UPDATE events
       SET title = ?, description = ?, starts_at = ?, ends_at = ?, event_type = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(
      next.title,
      next.description || null,
      next.startsAt,
      next.endsAt || null,
      next.eventType,
      next.updatedAt,
      eventId
    )
    .run();

  return getEvent(env, eventId);
}

export async function deleteEvent(env, eventId) {
  const existing = await getEvent(env, eventId);
  if (!existing) return null;

  const db = requireDb(env);
  await db.prepare("DELETE FROM events WHERE id = ?").bind(eventId).run();
  return existing;
}
