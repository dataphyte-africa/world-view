const { CO2_TABLE_SQL, CO2_COLUMNS } = require('./co2-sources');

let ensured = false;

async function ensureTable(env) {
  if (ensured) return;
  await env.DB.prepare(CO2_TABLE_SQL).run();
  const pragma = await env.DB.prepare('PRAGMA table_info(worldview_co2_sources)').all();
  const cols = new Set(pragma.results.map(function (r) { return r.name; }));
  for (const col of CO2_COLUMNS) {
    if (!cols.has(col)) {
      await env.DB.prepare('ALTER TABLE worldview_co2_sources ADD COLUMN ' + col + ' TEXT').run();
    }
  }
  ensured = true;
}

function mapRow(row) {
  return {
    id: row.id,
    lat: row.latitude,
    lng: row.longitude,
    operator: row.operator || '',
    location: row.location || '',
    description: row.description || '',
    imageUrl: row.image_url || '',
    createdAt: new Date(row.created_at + 'Z').getTime(),
  };
}

async function getAll(env) {
  await ensureTable(env);
  const { results } = await env.DB.prepare('SELECT * FROM worldview_co2_sources ORDER BY id').all();
  return results.map(mapRow);
}

async function count(env) {
  await ensureTable(env);
  const row = await env.DB.prepare('SELECT COUNT(*) as n FROM worldview_co2_sources').first();
  return Number(row.n);
}

async function createCo2(env, { lat, lng, operator, location, description, imageUrl }) {
  await ensureTable(env);
  const info = await env.DB.prepare(
    'INSERT INTO worldview_co2_sources (latitude, longitude, operator, location, description, image_url) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(lat, lng, operator || null, location || null, description || null, imageUrl || null)
    .run();
  const row = await env.DB.prepare('SELECT * FROM worldview_co2_sources WHERE id = ?')
    .bind(Number(info.meta.last_row_id))
    .first();
  return mapRow(row);
}

async function updateCo2(env, id, { operator, location, description, imageUrl }) {
  await ensureTable(env);
  const info = await env.DB.prepare(
    'UPDATE worldview_co2_sources SET operator = ?, location = ?, description = ?, image_url = ? WHERE id = ?'
  )
    .bind(operator || null, location || null, description || null, imageUrl || null, id)
    .run();
  if (!info.meta.changes) return null;
  const row = await env.DB.prepare('SELECT * FROM worldview_co2_sources WHERE id = ?').bind(id).first();
  return mapRow(row);
}

async function deleteCo2(env, id) {
  await ensureTable(env);
  const info = await env.DB.prepare('DELETE FROM worldview_co2_sources WHERE id = ?').bind(id).run();
  return info.meta.changes > 0;
}

async function ensureSeeded(env, sources) {
  const n = await count(env);
  if (n > 0) return false;
  for (const s of sources) {
    await createCo2(env, { lat: s.lat, lng: s.lng });
  }
  return true;
}

module.exports = { getAll, createCo2, updateCo2, deleteCo2, ensureSeeded };
