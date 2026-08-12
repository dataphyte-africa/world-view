const CO2_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS worldview_co2_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    operator TEXT,
    location TEXT,
    description TEXT,
    image_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`;

const CO2_COLUMNS = ['operator', 'location', 'description', 'image_url'];

const CO2_ALTER_SQL = CO2_COLUMNS.map((col) =>
  `ALTER TABLE worldview_co2_sources ADD COLUMN ${col} TEXT`
);

const DEFAULT_CO2_SOURCES = [
  { lat: 4.826555, lng: 5.968766 },
  { lat: 4.819328, lng: 5.962183 },
];

module.exports = { CO2_TABLE_SQL, CO2_COLUMNS, CO2_ALTER_SQL, DEFAULT_CO2_SOURCES };
