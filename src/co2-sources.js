const CO2_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS worldview_co2_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`;

const DEFAULT_CO2_SOURCES = [
  { lat: 4.826555, lng: 5.968766 },
  { lat: 4.819328, lng: 5.962183 },
];

module.exports = { CO2_TABLE_SQL, DEFAULT_CO2_SOURCES };
