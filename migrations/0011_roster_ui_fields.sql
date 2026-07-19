-- Comp roster UI: roster accent color + member situation.

ALTER TABLE rosters ADD COLUMN color TEXT;
ALTER TABLE roster_members ADD COLUMN situation TEXT;
