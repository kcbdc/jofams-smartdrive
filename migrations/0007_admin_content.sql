CREATE TABLE IF NOT EXISTS app_notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS app_content (
  content_key TEXT PRIMARY KEY,
  content_value TEXT NOT NULL DEFAULT '',
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- user_inquiries.user_email is added safely at runtime by functions/api/inquiries.js for existing databases.
