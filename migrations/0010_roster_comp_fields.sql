-- Comp roster fields: T17 id, multi-tournament tags; rename default roster.

ALTER TABLE roster_members ADD COLUMN t17_id TEXT;
ALTER TABLE roster_members ADD COLUMN tournaments TEXT;

UPDATE rosters
SET name = 'Comp Roster',
    notes = 'Default competition roster',
    updated_at = datetime('now')
WHERE id = 'roster-default' AND name = 'Clan Roster';
