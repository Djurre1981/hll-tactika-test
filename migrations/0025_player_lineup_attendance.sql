-- Per-event lineup attendance (for RSVP vs bench fairness tracking)

CREATE TABLE IF NOT EXISTS player_lineup_attendance (
  event_id TEXT NOT NULL,
  steam_id TEXT NOT NULL,
  was_confirmed INTEGER NOT NULL DEFAULT 0,
  was_playing INTEGER NOT NULL DEFAULT 0,
  was_reserve INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (event_id, steam_id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lineup_attendance_steam ON player_lineup_attendance(steam_id);
CREATE INDEX IF NOT EXISTS idx_lineup_attendance_event ON player_lineup_attendance(event_id);
