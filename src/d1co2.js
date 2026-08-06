const { CO2_TABLE_SQL } = require('./co2-sources');

let ensured = false;

async function ensureTable(env) {
  if (ensured) return;
  await env.DB.prepare(CO2_TABLE_SQL).run();
  ensured = true;
}

function mapRow(row) {
  return {
    id: row.id,
    lat: row.latitude,
    lng: row.longitude,
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

async function createCo2(env, { lat, lng }) {
  await ensureTable(env);
  const info = await env.DB.prepare(
    'INSERT INTO worldview_co2_sources (latitude, longitude) VALUES (?, ?)'
  )
    .bind(lat, lng)
    .run();
  const row = await env.DB.prepare('SELECT * FROM worldview_co2_sources WHERE id = ?')
    .bind(Number(info.meta.last_row_id))
    .first();
  return mapRow(row);
}

async function ensureSeeded(env, sources) {
  const n = await count(env);
  if (n > 0) return false;
  for (const s of sources) {
    await createCo2(env, { lat: s.lat, lng: s.lng });
  }
  return true;
}

module.exports = { getAll, createCo2, ensureSeeded };
