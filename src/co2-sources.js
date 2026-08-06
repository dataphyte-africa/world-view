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
  { lat: 5.012425, lng: 6.297389 },
  { lat: 5.026789, lng: 6.281389 },
  { lat: 4.851717, lng: 6.37125 },
  { lat: 4.887738, lng: 6.373789 },
  { lat: 4.56, lng: 5.92 },
  { lat: 4.7333, lng: 5.9833 },
  { lat: 4.7333, lng: 5.9833 },
  { lat: 4.7333, lng: 5.9833 },
  { lat: 4.4833, lng: 6.35 },
  { lat: 4.6672, lng: 6.308281 },
  { lat: 4.316944, lng: 6.242778 },
];

module.exports = { CO2_TABLE_SQL, DEFAULT_CO2_SOURCES };
