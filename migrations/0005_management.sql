-- Phase 5: clan roster (separate from site access) + strat folders

CREATE TABLE IF NOT EXISTS roster_members (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  steam_id TEXT,
  avatar_url TEXT,
  roster_role TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_roster_members_sort ON roster_members(sort_order, display_name);
CREATE INDEX IF NOT EXISTS idx_roster_members_steam_id ON roster_members(steam_id);

CREATE TABLE IF NOT EXISTS strat_folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES strat_folders(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_strat_folders_parent ON strat_folders(parent_id, sort_order);
