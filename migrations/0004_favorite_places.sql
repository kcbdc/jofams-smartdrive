CREATE TABLE IF NOT EXISTS favorite_places (
  owner_key TEXT NOT NULL,
  favorite_id TEXT NOT NULL,
  place_id TEXT,
  name TEXT NOT NULL,
  address TEXT,
  lng REAL NOT NULL,
  lat REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (owner_key, favorite_id)
);
CREATE INDEX IF NOT EXISTS idx_favorite_places_owner_updated ON favorite_places(owner_key, updated_at DESC);
