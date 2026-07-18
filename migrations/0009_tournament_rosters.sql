-- Multi-roster support: tournament-scoped rosters; members can belong to many.

CREATE TABLE IF NOT EXISTS rosters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tournament TEXT,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rosters_sort ON rosters(sort_order, name);

CREATE TABLE IF NOT EXISTS roster_memberships (
  roster_id TEXT NOT NULL REFERENCES rosters(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES roster_members(id) ON DELETE CASCADE,
  roster_role TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (roster_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_roster_memberships_member ON roster_memberships(member_id);
CREATE INDEX IF NOT EXISTS idx_roster_memberships_roster ON roster_memberships(roster_id, sort_order);

-- Seed default roster and attach existing clan members
INSERT OR IGNORE INTO rosters
  (id, name, tournament, notes, sort_order, created_by, created_at, updated_at)
VALUES
  (
    'roster-default',
    'Clan Roster',
    NULL,
    'Default clan roster',
    0,
    'system',
    datetime('now'),
    datetime('now')
  );

INSERT OR IGNORE INTO roster_memberships
  (roster_id, member_id, roster_role, sort_order, created_at)
SELECT
  'roster-default',
  id,
  roster_role,
  sort_order,
  COALESCE(created_at, datetime('now'))
FROM roster_members;
