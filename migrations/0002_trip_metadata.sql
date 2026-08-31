ALTER TABLE trip_events ADD COLUMN provider TEXT;
ALTER TABLE trip_events ADD COLUMN guide_type INTEGER;
CREATE INDEX IF NOT EXISTS idx_trip_events_provider ON trip_events(provider);
