-- Align Phase 0 schema to lead migration roadmap (DeepSeek share).
-- Required tables: pins, users, strats, events, teams, strat_folders.

PRAGMA foreign_keys = OFF;

ALTER TABLE folders RENAME TO strat_folders;

DROP INDEX IF EXISTS idx_folders_parent;
CREATE INDEX IF NOT EXISTS idx_strat_folders_parent ON strat_folders(parent_id);

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  description TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_starts ON events(starts_at);
