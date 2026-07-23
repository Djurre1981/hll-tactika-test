-- V1 Interactive Climb roster — separate from V2 `users` / `revoked_users`.
-- Pins remain shared. Steam profile cache remains shared (`steam_profiles`).

CREATE TABLE IF NOT EXISTS climb_users (
  steam_id TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('viewer', 'editor', 'assist', 'admin', 'owner')),
  display_name TEXT,
  avatar_url TEXT,
  preferences_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_signed_in_at TEXT
);

CREATE TABLE IF NOT EXISTS climb_revoked_users (
  steam_id TEXT PRIMARY KEY,
  revoked_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed from the previously shared roster so live V1 keeps existing members.
INSERT OR IGNORE INTO climb_users (
  steam_id, role, display_name, avatar_url, preferences_json,
  created_at, updated_at, last_signed_in_at
)
SELECT
  steam_id, role, display_name, avatar_url, preferences_json,
  created_at, updated_at, last_signed_in_at
FROM users;

INSERT OR IGNORE INTO climb_revoked_users (steam_id, revoked_at)
SELECT steam_id, revoked_at FROM revoked_users;
