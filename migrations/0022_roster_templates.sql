-- Roster templates + duplicate support (RallyPoint T11)

ALTER TABLE rosters ADD COLUMN is_template INTEGER NOT NULL DEFAULT 0;
