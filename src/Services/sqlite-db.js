const fs = require('fs');
const initSqlJs = require('sql.js');

let conn = null;

async function getConnection(dbPath) {
  if (conn) return conn;
  const SQL = await initSqlJs();
  const db = fs.existsSync(dbPath)
    ? new SQL.Database(fs.readFileSync(dbPath))
    : new SQL.Database();
  conn = {
    db,
    dbPath,
    save() {
      fs.writeFileSync(dbPath, Buffer.from(db.export()));
    },
  };
  return conn;
}

module.exports = { getConnection };
