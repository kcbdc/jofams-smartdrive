CREATE TABLE IF NOT EXISTS user_navigation_settings (
  owner_key TEXT PRIMARY KEY,
  route_preference TEXT NOT NULL DEFAULT 'recommend' CHECK(route_preference IN ('recommend','fast','free')),
  speed_camera_alert INTEGER NOT NULL DEFAULT 1,
  signal_camera_alert INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firebase_uid TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received' CHECK(status IN ('received','answered')),
  answer TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_user_inquiries_uid_created ON user_inquiries(firebase_uid,created_at DESC);
