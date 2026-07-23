-- Manual lock + admin unlock override for calendar events

ALTER TABLE events ADD COLUMN locked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN lock_override INTEGER NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN locked_by TEXT;
ALTER TABLE events ADD COLUMN locked_at TEXT;
