CREATE TABLE IF NOT EXISTS recent_destinations (
  owner_key TEXT NOT NULL,
  recent_id TEXT NOT NULL,
  place_id TEXT,
  name TEXT NOT NULL,
  address TEXT,
  lng REAL NOT NULL,
  lat REAL NOT NULL,
  last_used_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (owner_key, recent_id)
);
CREATE INDEX IF NOT EXISTS idx_recent_destinations_owner_used ON recent_destinations(owner_key,last_used_at DESC);
