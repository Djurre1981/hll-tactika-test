-- Phase 2 auth persistence: revocable opaque sessions and roster metadata.

CREATE TABLE IF NOT EXISTS users (
  steam_id TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('viewer', 'editor', 'assist', 'admin', 'owner')),
  display_name TEXT,
  avatar_url TEXT,
  preferences_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS revoked_users (
  steam_id TEXT PRIMARY KEY,
  revoked_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE users ADD COLUMN last_signed_in_at TEXT;

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  steam_id TEXT NOT NULL REFERENCES users(steam_id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_sessions_steam_id ON sessions(steam_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
