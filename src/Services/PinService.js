const { getConnection } = require('./sqlite-db');

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

class LocalSqliteAdapter {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.conn = null;
  }

  async init() {
    this.conn = await getConnection(this.dbPath);
    this.conn.db.run(TABLE_SQL);
    this.conn.save();
  }

  _save() {
    this.conn.save();
  }

  async getAll() {
    const stmt = this.conn.db.prepare('SELECT * FROM worldview_pins ORDER BY created_at DESC');
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows.map(mapRow);
  }

  async create({ name, lat, lng, imageUrl }) {
    this.conn.db.run(
      'INSERT INTO worldview_pins (name, latitude, longitude, image_url) VALUES (?, ?, ?, ?)',
      [name, lat, lng, imageUrl || null]
    );
    const id = this.conn.db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
    this._save();
    const stmt = this.conn.db.prepare('SELECT * FROM worldview_pins WHERE id = ?');
    stmt.bind([id]);
    stmt.step();
    const row = stmt.getAsObject();
    stmt.free();
    return mapRow(row);
  }

  async delete(id) {
    this.conn.db.run('DELETE FROM worldview_pins WHERE id = ?', [id]);
    const changed = this.conn.db.getRowsModified();
    this._save();
    return changed > 0;
  }
}

class PinService {
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

  delete(id) {
    return this.adapter.delete(id);
  }
}

function createPinService({ dbPath }) {
  return new PinService(new LocalSqliteAdapter(dbPath));
}

module.exports = { PinService, createPinService };
