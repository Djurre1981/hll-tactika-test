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

          return null;
        },

        async all() {
          if (/FROM events\b/i.test(sql) && /starts_at >= \? AND starts_at < \?/i.test(sql)) {
            const [from, to] = binds;
            const filtered = rowsFor("events")
              .filter((row) => row.starts_at >= from && row.starts_at < to)
              .sort((a, b) => compareValues(a.starts_at, b.starts_at));
            return { results: filtered };
          }
          return { results: [] };
        },

        async run() {
          if (/INSERT INTO events\b/i.test(sql)) {
            const [
              id,
              title,
              description,
              starts_at,
              ends_at,
              event_type,
              match_json,
              components_json,
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
              match_json,
              components_json,
              created_by,
              created_at,
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
              match_json,
              components_json,
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
              match_json,
              components_json,
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
