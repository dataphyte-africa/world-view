CREATE TABLE IF NOT EXISTS worldview_pins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  image_url TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
