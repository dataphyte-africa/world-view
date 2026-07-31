const fs = require('fs');
const initSqlJs = require('sql.js');

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
    this.db = null;
  }

  async init() {
    const SQL = await initSqlJs();
    if (fs.existsSync(this.dbPath)) {
      this.db = new SQL.Database(fs.readFileSync(this.dbPath));
    } else {
      this.db = new SQL.Database();
    }
    this.db.run(TABLE_SQL);
    this._save();
  }

  _save() {
    fs.writeFileSync(this.dbPath, Buffer.from(this.db.export()));
  }

  getAll() {
    const stmt = this.db.prepare('SELECT * FROM worldview_pins ORDER BY created_at DESC');
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows.map(mapRow);
  }

  create({ name, lat, lng, imageUrl }) {
    this.db.run(
      'INSERT INTO worldview_pins (name, latitude, longitude, image_url) VALUES (?, ?, ?, ?)',
      [name, lat, lng, imageUrl || null]
    );
    const id = this.db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
    this._save();
    const stmt = this.db.prepare('SELECT * FROM worldview_pins WHERE id = ?');
    stmt.bind([id]);
    stmt.step();
    const row = stmt.getAsObject();
    stmt.free();
    return mapRow(row);
  }

  delete(id) {
    this.db.run('DELETE FROM worldview_pins WHERE id = ?', [id]);
    const changed = this.db.getRowsModified();
    this._save();
    return changed > 0;
  }
}

class TursoAdapter {
  constructor(url, authToken) {
    const { createClient } = require('@libsql/client');
    this.client = createClient({ url, authToken: authToken || undefined });
  }

  async init() {
    await this.client.execute(TABLE_SQL);
  }

  async getAll() {
    const rs = await this.client.execute('SELECT * FROM worldview_pins ORDER BY created_at DESC');
    return rs.rows.map(mapRow);
  }

  async _getById(id) {
    const rs = await this.client.execute({
      sql: 'SELECT * FROM worldview_pins WHERE id = ?',
      args: [id],
    });
    if (!rs.rows.length) return null;
    return mapRow(rs.rows[0]);
  }

  async create({ name, lat, lng, imageUrl }) {
    const rs = await this.client.execute({
      sql: 'INSERT INTO worldview_pins (name, latitude, longitude, image_url) VALUES (?, ?, ?, ?)',
      args: [name, lat, lng, imageUrl || null],
    });
    return this._getById(Number(rs.lastInsertRowid));
  }

  async delete(id) {
    const rs = await this.client.execute({
      sql: 'DELETE FROM worldview_pins WHERE id = ?',
      args: [id],
    });
    return rs.rowsAffected > 0;
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
  if (process.env.TURSO_DATABASE_URL) {
    return new PinService(new TursoAdapter(process.env.TURSO_DATABASE_URL, process.env.TURSO_AUTH_TOKEN));
  }
  return new PinService(new LocalSqliteAdapter(dbPath));
}

module.exports = { PinService, createPinService };
