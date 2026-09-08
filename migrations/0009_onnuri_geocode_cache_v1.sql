CREATE TABLE IF NOT EXISTS onnuri_geocode_cache_v1 (
  cache_key TEXT PRIMARY KEY,
  region TEXT,
  market TEXT,
  merchant TEXT,
  lng REAL NOT NULL,
  lat REAL NOT NULL,
  precision TEXT,
  matched_place_name TEXT,
  matched_address TEXT,
  geocoded_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_onnuri_geocode_cache_v1_market
ON onnuri_geocode_cache_v1(market);
