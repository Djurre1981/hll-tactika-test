-- T6b: signup target, waitlist, raincheck reasons

ALTER TABLE events ADD COLUMN signup_target INTEGER;

-- Recreate rsvps with waitlist + reason columns (SQLite cannot alter CHECK)
CREATE TABLE IF NOT EXISTS rsvps_new (
  event_id TEXT NOT NULL,
  steam_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'tentative', 'declined', 'unavailable', 'waitlist')),
  reason_code TEXT,
  reason_note TEXT,
  queued_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (event_id, steam_id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

INSERT INTO rsvps_new (event_id, steam_id, status, reason_code, reason_note, queued_at, updated_at)
SELECT event_id, steam_id, status, NULL, NULL, NULL, updated_at
FROM rsvps;

DROP TABLE rsvps;
ALTER TABLE rsvps_new RENAME TO rsvps;

CREATE INDEX IF NOT EXISTS idx_rsvps_event_status ON rsvps(event_id, status);
CREATE INDEX IF NOT EXISTS idx_rsvps_steam ON rsvps(steam_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_waitlist_queue ON rsvps(event_id, queued_at) WHERE status = 'waitlist';
