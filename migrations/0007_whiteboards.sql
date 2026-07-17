-- Phase 7: Micro-Prep Excalidraw whiteboards (no Yjs yet)

CREATE TABLE IF NOT EXISTS whiteboards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  scene_json TEXT NOT NULL DEFAULT '{}',
  background_url TEXT,
  created_by TEXT NOT NULL,
  created_by_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_whiteboards_updated_at ON whiteboards(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_whiteboards_created_by ON whiteboards(created_by);
