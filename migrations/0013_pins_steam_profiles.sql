-- Shared climbing-guide columns + Steam profile cache (V1 + V2 same D1).
-- Audit log stays in KV.

ALTER TABLE pins ADD COLUMN source_discord_message_id TEXT;

CREATE TABLE IF NOT EXISTS steam_profiles (
  steam_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT,
  cached_at INTEGER NOT NULL
);
