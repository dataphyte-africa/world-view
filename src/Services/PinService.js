const fs = require('fs');
const initSqlJs = require('sql.js');

class PinService {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
  }

  async init() {
    const SQL = await initSqlJs();
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }
    this.db.run(`
      CREATE TABLE IF NOT EXISTS worldview_pins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        image_url TEXT,
        metadata TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    this._save();
  }

  _save() {
    const data = this.db.export();
    fs.writeFileSync(this.dbPath, Buffer.from(data));
  }

  getAll() {
    const stmt = this.db.prepare('SELECT * FROM worldview_pins ORDER BY created_at DESC');
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      lat: row.latitude,
      lng: row.longitude,
      imageUrl: row.image_url || '',
      createdAt: new Date(row.created_at + 'Z').getTime(),
    }));
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
    return {
      id: row.id,
      name: row.name,
      lat: row.latitude,
      lng: row.longitude,
      imageUrl: row.image_url || '',
      createdAt: new Date(row.created_at + 'Z').getTime(),
    };
  }

  delete(id) {
    this.db.run('DELETE FROM worldview_pins WHERE id = ?', [id]);
    const changes = this.db.getRowsModified();
    this._save();
    return changes > 0;
  }
}

module.exports = { PinService };
