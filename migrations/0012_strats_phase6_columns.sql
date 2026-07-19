-- 0001 created strats with team/type/match_* columns.
-- 0006 used CREATE TABLE IF NOT EXISTS, so Phase 6 columns were never added.
-- Align existing strats tables to the Phase 6 shape used by strats-store.js.

ALTER TABLE strats ADD COLUMN tags TEXT NOT NULL DEFAULT '{}';
ALTER TABLE strats ADD COLUMN match_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE strats ADD COLUMN locked_by TEXT;
ALTER TABLE strats ADD COLUMN slides TEXT NOT NULL DEFAULT '[]';
ALTER TABLE strats ADD COLUMN import_source TEXT;
ALTER TABLE strats ADD COLUMN created_by_name TEXT;

UPDATE strats
SET tags = json_object(
  'team', COALESCE(team, 'jr'),
  'type', COALESCE(type, 'friendly')
)
WHERE tags = '{}';

UPDATE strats
SET match_json = json_object(
  'date', match_date,
  'faction', match_faction,
  'mapId', match_map_id,
  'startingPoint', match_starting_point,
  'opponent', match_opponent,
  'result', match_result
)
WHERE match_json = '{}';

CREATE INDEX IF NOT EXISTS idx_strats_folder_id ON strats(folder_id);
CREATE INDEX IF NOT EXISTS idx_strats_updated_at ON strats(updated_at);
