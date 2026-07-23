-- RSVP / attendance per calendar event (RallyPoint T6)

CREATE TABLE IF NOT EXISTS rsvps (
  event_id TEXT NOT NULL,
  steam_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'tentative', 'declined', 'unavailable')),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (event_id, steam_id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rsvps_event_status ON rsvps(event_id, status);
CREATE INDEX IF NOT EXISTS idx_rsvps_steam ON rsvps(steam_id);
