-- Slim per-player per-match combat snapshot (HeLO / CRCON)

CREATE TABLE IF NOT EXISTS player_match_stats (
  event_id TEXT NOT NULL,
  steam_id TEXT NOT NULL,
  side TEXT,
  display_name TEXT,
  kills INTEGER NOT NULL DEFAULT 0,
  deaths INTEGER NOT NULL DEFAULT 0,
  combat_points INTEGER NOT NULL DEFAULT 0,
  support_points INTEGER NOT NULL DEFAULT 0,
  offensive_points INTEGER NOT NULL DEFAULT 0,
  defensive_points INTEGER NOT NULL DEFAULT 0,
  playtime_seconds INTEGER NOT NULL DEFAULT 0,
  kpm REAL,
  source TEXT NOT NULL DEFAULT 'helo',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (event_id, steam_id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_player_match_stats_steam ON player_match_stats(steam_id);
CREATE INDEX IF NOT EXISTS idx_player_match_stats_event ON player_match_stats(event_id);
