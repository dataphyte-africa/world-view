const { getConnection } = require('./sqlite-db');
const { CO2_TABLE_SQL, CO2_COLUMNS, CO2_ALTER_SQL } = require('../co2-sources');

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

class LocalSqliteAdapter {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.conn = null;
  }

  async init() {
    this.conn = await getConnection(this.dbPath);
    this.conn.db.run(CO2_TABLE_SQL);
    const cols = new Set();
    const pragma = this.conn.db.exec('PRAGMA table_info(worldview_co2_sources)');
    const rows = pragma.length ? pragma[0].values : [];
    rows.forEach(function (r) { cols.add(r[1]); });
    const toAdd = CO2_COLUMNS.filter(function (c) { return !cols.has(c); });
    toAdd.forEach(function (c) {
      this.conn.db.run('ALTER TABLE worldview_co2_sources ADD COLUMN ' + c + ' TEXT');
    }, this);
    this.conn.save();
  }

  _save() {
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

  async create({ lat, lng, operator, location, description, imageUrl }) {
    this.conn.db.run(
      'INSERT INTO worldview_co2_sources (latitude, longitude, operator, location, description, image_url) VALUES (?, ?, ?, ?, ?, ?)',
      [lat, lng, operator || null, location || null, description || null, imageUrl || null]
    );
    const id = this.conn.db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
    this._save();
    return this._getById(id);
  }

  async update(id, { operator, location, description, imageUrl }) {
    const stmt = this.conn.db.prepare(
      'UPDATE worldview_co2_sources SET operator = ?, location = ?, description = ?, image_url = ? WHERE id = ?'
    );
    stmt.run([operator || null, location || null, description || null, imageUrl || null, id]);
    stmt.free();
    this._save();
    return this._getById(id);
  }

  async delete(id) {
    const stmt = this.conn.db.prepare('DELETE FROM worldview_co2_sources WHERE id = ?');
    stmt.run([id]);
    const changed = this.conn.db.getRowsModified();
    stmt.free();
    this._save();
    return changed > 0;
  }

  _getById(id) {
    const stmt = this.conn.db.prepare('SELECT * FROM worldview_co2_sources WHERE id = ?');
    stmt.bind([id]);
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
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

  create(data) {
    return this.adapter.create(data);
  }

  update(id, data) {
    return this.adapter.update(id, data);
  }

  delete(id) {
    return this.adapter.delete(id);
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
