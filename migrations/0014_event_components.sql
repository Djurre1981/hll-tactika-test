-- Event hub: component ID lists for strats / route plans / whiteboards / roster

ALTER TABLE events ADD COLUMN components_json TEXT NOT NULL DEFAULT '{}';
