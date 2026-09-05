CREATE TABLE IF NOT EXISTS road_congestion_stats (
  cell_key TEXT PRIMARY KEY,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  road_name TEXT,
  sample_count INTEGER NOT NULL DEFAULT 0,
  severe_count INTEGER NOT NULL DEFAULT 0,
  last_state INTEGER,
  last_speed REAL,
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_road_congestion_stats_latlng ON road_congestion_stats(lat,lng);
