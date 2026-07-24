-- LineUp size on events + lineups table (Match Brief component)

ALTER TABLE events ADD COLUMN roster_size INTEGER;

CREATE TABLE IF NOT EXISTS lineups (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  roster_size INTEGER NOT NULL,
  locked INTEGER NOT NULL DEFAULT 0,
  locked_by TEXT,
  locked_at TEXT,
  layout_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lineups_event_id ON lineups(event_id);
