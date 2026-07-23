-- T2: match metadata (opponent, map, faction, starting point, result) on calendar events

ALTER TABLE events ADD COLUMN match_json TEXT NOT NULL DEFAULT '{}';
