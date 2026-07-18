-- Phase 6: strats metadata + slides JSON in D1 (KV reserved for Yjs later)

CREATE TABLE IF NOT EXISTS strats (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '{}',
  notes TEXT NOT NULL DEFAULT '',
  match_json TEXT NOT NULL DEFAULT '{}',
  folder_id TEXT REFERENCES strat_folders(id) ON DELETE SET NULL,
  locked INTEGER NOT NULL DEFAULT 0,
  locked_by TEXT,
  slides TEXT NOT NULL DEFAULT '[]',
  import_source TEXT,
  created_by TEXT NOT NULL,
  created_by_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_strats_folder_id ON strats(folder_id);
CREATE INDEX IF NOT EXISTS idx_strats_updated_at ON strats(updated_at);
