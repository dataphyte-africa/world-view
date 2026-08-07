const { getConnection } = require('./sqlite-db');
const { CO2_TABLE_SQL } = require('../co2-sources');

function mapRow(row) {
  return {
    id: row.id,
    lat: row.latitude,
    lng: row.longitude,
    createdAt: new Date(row.created_at + 'Z').getTime(),
  };
}

class LocalSqliteAdapter {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.conn = null;
  }

  async init() {
    this.conn = await getConnection(this.dbPath);
    this.conn.db.run(CO2_TABLE_SQL);
    this.conn.save();
  }

  async getAll() {
    const stmt = this.conn.db.prepare('SELECT * FROM worldview_co2_sources ORDER BY id');
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows.map(mapRow);
  }

  async count() {
    const res = this.conn.db.exec('SELECT COUNT(*) as n FROM worldview_co2_sources');
    return res[0].values[0][0];
  }

  async create({ lat, lng }) {
    this.conn.db.run(
      'INSERT INTO worldview_co2_sources (latitude, longitude) VALUES (?, ?)',
      [lat, lng]
    );
    const id = this.conn.db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
    this.conn.save();
    const stmt = this.conn.db.prepare('SELECT * FROM worldview_co2_sources WHERE id = ?');
    stmt.bind([id]);
    stmt.step();
    const row = stmt.getAsObject();
    stmt.free();
    return mapRow(row);
  }
}

class Co2Service {
  constructor(adapter) {
    this.adapter = adapter;
  }

  init() {
    return this.adapter.init();
  }

  getAll() {
    return this.adapter.getAll();
  }

  async ensureSeeded(sources) {
    const count = await this.adapter.count();
    if (count > 0) return false;
    for (const s of sources) {
      await this.adapter.create({ lat: s.lat, lng: s.lng });
    }
    return true;
  }
}

function createCo2Service({ dbPath }) {
  return new Co2Service(new LocalSqliteAdapter(dbPath));
}

module.exports = { Co2Service, createCo2Service };
