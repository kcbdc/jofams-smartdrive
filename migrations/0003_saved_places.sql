CREATE TABLE IF NOT EXISTS saved_places (
  owner_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('home','work')),
  place_id TEXT,
  name TEXT NOT NULL,
  address TEXT,
  lng REAL NOT NULL,
  lat REAL NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (owner_key, kind)
);
CREATE INDEX IF NOT EXISTS idx_saved_places_owner ON saved_places(owner_key);
