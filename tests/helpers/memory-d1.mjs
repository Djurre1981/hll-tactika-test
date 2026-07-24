/**
 * Minimal in-memory D1 mock for events-store integration tests.
 * Handles only the SQL shapes used by events-store and component lookup stores.
 */

function tableFromSql(sql) {
  const normalized = sql.replace(/\s+/g, " ").trim();
  const fromMatch = normalized.match(/\bFROM\s+(\w+)/i);
  if (fromMatch) return fromMatch[1];
  const intoMatch = normalized.match(/\bINTO\s+(\w+)/i);
  if (intoMatch) return intoMatch[1];
  const updateMatch = normalized.match(/\bUPDATE\s+(\w+)/i);
  if (updateMatch) return updateMatch[1];
  return null;
}

function compareValues(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "string" && typeof b === "string") {
    return a.localeCompare(b);
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

export function createMemoryD1(seed = {}) {
  const tables = {
    events: new Map(),
    strats: new Map(),
    route_plans: new Map(),
    whiteboards: new Map(),
    rosters: new Map(),
    prep_tasks: new Map(),
  };

  for (const [table, rows] of Object.entries(seed)) {
    if (!tables[table]) continue;
    for (const row of rows) {
      tables[table].set(row.id, { ...row });
    }
  }

  function rowsFor(table) {
    return [...(tables[table]?.values() || [])];
  }

  function findById(table, id) {
    return tables[table]?.get(id) || null;
  }

  return {
    /** Direct seed access for tests */
    seedRow(table, row) {
      tables[table].set(row.id, { ...row });
    },

    prepare(sql) {
      const table = tableFromSql(sql);
      const binds = [];

      const stmt = {
        bind(...args) {
          binds.length = 0;
          binds.push(...args);
          return stmt;
        },

        async first() {
          if (/FROM events\b/i.test(sql) && /WHERE id = \?/i.test(sql)) {
            return findById("events", binds[0]) || null;
          }

          if (/FROM strats\b/i.test(sql) && /WHERE id = \?/i.test(sql)) {
            return findById("strats", binds[0]) || null;
          }

          if (/FROM route_plans\b/i.test(sql) && /WHERE id = \?/i.test(sql)) {
            return findById("route_plans", binds[0]) || null;
          }

          if (/FROM whiteboards\b/i.test(sql) && /WHERE id = \?/i.test(sql)) {
            return findById("whiteboards", binds[0]) || null;
          }

          if (/FROM rosters r\b/i.test(sql) && /WHERE r\.id = \?/i.test(sql)) {
            const row = findById("rosters", binds[0]);
            if (!row) return null;
            return { ...row, member_count: row.member_count ?? 0 };
          }

          if (/FROM prep_tasks\b/i.test(sql) && /WHERE event_id = \? AND id = \?/i.test(sql)) {
            const row = findById("prep_tasks", binds[1]);
            if (!row || row.event_id !== binds[0]) return null;
            return row;
          }

          return null;
        },

        async all() {
          if (/FROM events\b/i.test(sql) && !/WHERE/i.test(sql)) {
            return { results: rowsFor("events") };
          }

          if (/FROM events\b/i.test(sql) && /starts_at >= \? AND starts_at < \?/i.test(sql)) {
            const [from, to] = binds;
            const filtered = rowsFor("events")
              .filter((row) => row.starts_at >= from && row.starts_at < to)
              .sort((a, b) => compareValues(a.starts_at, b.starts_at));
            return { results: filtered };
          }

          if (/FROM prep_tasks\b/i.test(sql) && /WHERE event_id = \?/i.test(sql) && !/AND id = \?/i.test(sql)) {
            const filtered = rowsFor("prep_tasks")
              .filter((row) => row.event_id === binds[0])
              .sort((a, b) => {
                const completedDiff = (a.completed ?? 0) - (b.completed ?? 0);
                if (completedDiff !== 0) return completedDiff;
                return compareValues(a.created_at, b.created_at);
              });
            return { results: filtered };
          }

          if (/FROM prep_tasks pt\b/i.test(sql) && /INNER JOIN events e/i.test(sql)) {
            const [steamId, from, to] = binds;
            const filtered = rowsFor("prep_tasks")
              .filter((row) => row.assignee_steam_id === steamId && row.completed === 0)
              .map((row) => {
                const event = findById("events", row.event_id);
                if (!event || event.starts_at < from || event.starts_at >= to) return null;
                return {
                  ...row,
                  event_title: event.title,
                  event_starts_at: event.starts_at,
                  event_event_type: event.event_type,
                };
              })
              .filter(Boolean)
              .sort((a, b) => {
                const eventDiff = compareValues(a.event_starts_at, b.event_starts_at);
                if (eventDiff !== 0) return eventDiff;
                return compareValues(a.created_at, b.created_at);
              });
            return { results: filtered };
          }

          return { results: [] };
        },

        async run() {
          if (/INSERT INTO prep_tasks\b/i.test(sql)) {
            const [
              id,
              event_id,
              title,
              description,
              assignee_steam_id,
              completed,
              completed_at,
              created_by,
              created_at,
              updated_at,
            ] = binds;
            tables.prep_tasks.set(id, {
              id,
              event_id,
              title,
              description,
              assignee_steam_id,
              completed,
              completed_at,
              created_by,
              created_at,
              updated_at,
            });
            return { success: true };
          }

          if (/UPDATE prep_tasks\b/i.test(sql)) {
            const [
              title,
              description,
              assignee_steam_id,
              completed,
              completed_at,
              updated_at,
              event_id,
              id,
            ] = binds;
            const existing = findById("prep_tasks", id);
            if (!existing || existing.event_id !== event_id) return { success: false };
            tables.prep_tasks.set(id, {
              ...existing,
              title,
              description,
              assignee_steam_id,
              completed,
              completed_at,
              updated_at,
            });
            return { success: true };
          }

          if (/DELETE FROM prep_tasks\b/i.test(sql)) {
            const [event_id, id] = binds;
            const existing = findById("prep_tasks", id);
            if (existing?.event_id === event_id) {
              tables.prep_tasks.delete(id);
            }
            return { success: true };
          }

          if (/INSERT INTO events\b/i.test(sql)) {
            const [
              id,
              title,
              description,
              starts_at,
              ends_at,
              event_type,
              signup_target,
              roster_size,
              match_json,
              components_json,
              locked,
              lock_override,
              locked_by,
              locked_at,
              created_by,
              created_at,
              updated_at,
            ] = binds;
            tables.events.set(id, {
              id,
              title,
              description,
              starts_at,
              ends_at,
              event_type,
              signup_target: signup_target ?? null,
              roster_size: roster_size ?? null,
              match_json,
              components_json,
              locked: locked ?? 0,
              lock_override: lock_override ?? 0,
              locked_by: locked_by ?? null,
              locked_at: locked_at ?? null,
              created_by,
              created_at,
              updated_at,
            });
            return { success: true };
          }

          if (/UPDATE events\b/i.test(sql) && /SET locked = 1/i.test(sql)) {
            const [locked_by, locked_at, updated_at, id] = binds;
            const existing = findById("events", id);
            if (!existing) return { success: false };
            tables.events.set(id, {
              ...existing,
              locked: 1,
              lock_override: 0,
              locked_by,
              locked_at,
              updated_at,
            });
            return { success: true };
          }

          if (/UPDATE events\b/i.test(sql) && /SET locked = 0/i.test(sql) && /lock_override = 1/i.test(sql)) {
            const [updated_at, id] = binds;
            const existing = findById("events", id);
            if (!existing) return { success: false };
            tables.events.set(id, {
              ...existing,
              locked: 0,
              lock_override: 1,
              locked_by: null,
              locked_at: null,
              updated_at,
            });
            return { success: true };
          }

          if (/UPDATE events\b/i.test(sql)) {
            const [
              title,
              description,
              starts_at,
              ends_at,
              event_type,
              signup_target,
              roster_size,
              match_json,
              components_json,
              locked,
              lock_override,
              locked_by,
              locked_at,
              updated_at,
              id,
            ] = binds;
            const existing = findById("events", id);
            if (!existing) return { success: false };
            tables.events.set(id, {
              ...existing,
              title,
              description,
              starts_at,
              ends_at,
              event_type,
              signup_target: signup_target ?? existing.signup_target ?? null,
              roster_size: roster_size ?? existing.roster_size ?? null,
              match_json,
              components_json,
              locked: locked ?? existing.locked ?? 0,
              lock_override: lock_override ?? existing.lock_override ?? 0,
              locked_by: locked_by ?? existing.locked_by ?? null,
              locked_at: locked_at ?? existing.locked_at ?? null,
              updated_at,
            });
            return { success: true };
          }

          if (/DELETE FROM events\b/i.test(sql)) {
            tables.events.delete(binds[0]);
            return { success: true };
          }

          return { success: true };
        },
      };

      return stmt;
    },
  };
}

export function createTestEnv(seed = {}) {
  return { DB: createMemoryD1(seed) };
}

export function minimalStratRow(id) {
  const now = new Date().toISOString();
  return {
    id,
    title: "Test strat",
    tags: "[]",
    notes: "",
    match_json: "{}",
    folder_id: null,
    locked: 0,
    locked_by: null,
    slides: "[]",
    import_source: null,
    created_by: "76561198000000000",
    created_by_name: "Tester",
    created_at: now,
    updated_at: now,
  };
}

export function minimalRoutePlanRow(id) {
  const now = new Date().toISOString();
  return {
    id,
    title: "Test route",
    plan_json: "{}",
    created_by: "76561198000000000",
    created_by_name: "Tester",
    created_at: now,
    updated_at: now,
  };
}

export function minimalWhiteboardRow(id) {
  const now = new Date().toISOString();
  return {
    id,
    title: "Test board",
    mode: "whiteboard",
    scene_json: "{}",
    background_url: null,
    created_by: "76561198000000000",
    created_by_name: "Tester",
    created_at: now,
    updated_at: now,
  };
}

export function minimalRosterRow(id) {
  const now = new Date().toISOString();
  return {
    id,
    name: "Test roster",
    tournament: null,
    color: null,
    notes: "",
    sort_order: 0,
    member_count: 0,
    created_by: "76561198000000000",
    created_at: now,
    updated_at: now,
  };
}
