-- Player prep task assignments per calendar event

CREATE TABLE IF NOT EXISTS prep_tasks (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  assignee_steam_id TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_prep_tasks_event_id ON prep_tasks(event_id);
CREATE INDEX IF NOT EXISTS idx_prep_tasks_assignee ON prep_tasks(assignee_steam_id, completed);
