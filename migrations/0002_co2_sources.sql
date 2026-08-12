CREATE TABLE IF NOT EXISTS worldview_co2_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  operator TEXT,
  location TEXT,
  description TEXT,
  image_url TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
