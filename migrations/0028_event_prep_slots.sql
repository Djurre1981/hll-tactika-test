-- Structured event preparation slots (fixed types + assignments).
CREATE TABLE IF NOT EXISTS event_prep_slots (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  primary_steam_id TEXT,
  helper_steam_ids TEXT NOT NULL DEFAULT '[]',
  completed_at TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(event_id, task_type),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_event_prep_slots_event_id ON event_prep_slots(event_id);
CREATE INDEX IF NOT EXISTS idx_event_prep_slots_primary ON event_prep_slots(primary_steam_id, completed_at);
