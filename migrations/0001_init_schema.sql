-- Phase 0 foundation schema for Tactika v2.
-- Structured app data lives in D1. Yjs collaboration snapshots stay in KV.
-- See docs/migration-plan.md and docs/migration-roadmap.md.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Users & access
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  steam_id TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('viewer', 'editor', 'assist', 'admin', 'owner')),
  display_name TEXT,
  avatar_url TEXT,
  preferences_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE revoked_users (
  steam_id TEXT PRIMARY KEY,
  revoked_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Climbing guide pins (row-level; replaces KV "pins" blob)
-- ---------------------------------------------------------------------------

CREATE TABLE pins (
  id TEXT PRIMARY KEY,
  map_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  tag TEXT NOT NULL DEFAULT 'climb',
  faction TEXT NOT NULL DEFAULT 'neutral'
    CHECK (faction IN ('axis', 'allies', 'neutral')),
  x REAL NOT NULL,
  y REAL NOT NULL,
  dir_x REAL,
  dir_y REAL,
  video_url TEXT,
  thumbnail TEXT,
  requires_json TEXT,
  media_items_json TEXT,
  created_by TEXT,
  created_by_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_pins_map ON pins(map_id);
CREATE INDEX idx_pins_created_by ON pins(created_by);

-- ---------------------------------------------------------------------------
-- Strat folders (Phase 4 browser tree; nullable folder_id on strats)
-- ---------------------------------------------------------------------------

CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_folders_parent ON folders(parent_id);

-- ---------------------------------------------------------------------------
-- Strats metadata (searchable columns) + slides (objects remain JSON)
-- ---------------------------------------------------------------------------

CREATE TABLE strats (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  team TEXT NOT NULL DEFAULT 'jr'
    CHECK (team IN ('jr', 'sr')),
  type TEXT NOT NULL DEFAULT 'friendly'
    CHECK (type IN ('friendly', 'tournament')),
  notes TEXT,
  locked INTEGER NOT NULL DEFAULT 0 CHECK (locked IN (0, 1)),
  folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  match_date TEXT,
  match_faction TEXT CHECK (match_faction IS NULL OR match_faction IN ('', 'axis', 'allies')),
  match_map_id TEXT,
  match_starting_point TEXT,
  match_opponent TEXT,
  match_result TEXT CHECK (match_result IS NULL OR match_result IN ('', 'win', 'loss')),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_strats_folder ON strats(folder_id);
CREATE INDEX idx_strats_team_type ON strats(team, type);
CREATE INDEX idx_strats_updated ON strats(updated_at);

CREATE TABLE slides (
  id TEXT PRIMARY KEY,
  strat_id TEXT NOT NULL REFERENCES strats(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled',
  map_id TEXT NOT NULL,
  slide_order INTEGER NOT NULL DEFAULT 0,
  objects_json TEXT NOT NULL DEFAULT '[]',
  raster_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_slides_strat_order ON slides(strat_id, slide_order);

-- ---------------------------------------------------------------------------
-- Collaboration room metadata (Yjs document blobs stay in KV)
-- ---------------------------------------------------------------------------

CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  strat_id TEXT REFERENCES strats(id) ON DELETE SET NULL,
  title TEXT,
  created_by TEXT,
  last_snapshot_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_rooms_strat ON rooms(strat_id);
