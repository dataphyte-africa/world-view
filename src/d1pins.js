const TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS worldview_pins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    image_url TEXT,
    metadata TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`;

let ensured = false;

async function ensureTable(env) {
  if (ensured) return;
  await env.DB.prepare(TABLE_SQL).run();
  ensured = true;
}

function mapRow(row) {
  return {
    id: row.id,
    name: row.name,
    lat: row.latitude,
    lng: row.longitude,
    imageUrl: row.image_url || '',
    createdAt: new Date(row.created_at + 'Z').getTime(),
  };
}

async function getAll(env) {
  await ensureTable(env);
  const { results } = await env.DB.prepare('SELECT * FROM worldview_pins ORDER BY created_at DESC').all();
  return results.map(mapRow);
}

async function createPin(env, { name, lat, lng, imageUrl }) {
  await ensureTable(env);
  const info = await env.DB.prepare(
    'INSERT INTO worldview_pins (name, latitude, longitude, image_url) VALUES (?, ?, ?, ?)'
  )
    .bind(name, lat, lng, imageUrl || null)
    .run();
  const row = await env.DB.prepare('SELECT * FROM worldview_pins WHERE id = ?')
    .bind(Number(info.meta.last_row_id))
    .first();
  return mapRow(row);
}

async function deletePin(env, id) {
  await ensureTable(env);
  const info = await env.DB.prepare('DELETE FROM worldview_pins WHERE id = ?').bind(id).run();
  return info.meta.changes > 0;
}

module.exports = { getAll, createPin, deletePin };
