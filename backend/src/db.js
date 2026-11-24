require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');

// Production (free hosting): a Turso cloud database via TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
// Local / VPS / disk: a plain SQLite file at DB_FILE (default backend/data/clickshare.db).
function connect() {
  if (process.env.TURSO_DATABASE_URL) {
    return createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  const file = path.resolve(process.env.DB_FILE || path.join(__dirname, '..', 'data', 'clickshare.db'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return createClient({ url: `file:${file.replace(/\\/g, '/')}` });
}

const client = connect();

/** Current UTC time as an ISO string, for use inside SQL. */
const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

// libSQL rejects undefined/boolean values: normalise them
const clean = (params = {}) =>
  Object.fromEntries(Object.entries(params).map(([k, v]) =>
    [k, v === undefined ? null : typeof v === 'boolean' ? Number(v) : v]));

const toObjects = (rs) => rs.rows.map((r) => Object.fromEntries(rs.columns.map((c, i) => [c, r[i]])));

/** Run a parameterised query: query('SELECT * FROM Users WHERE Id=@id', { id }) */
async function query(sql, params) {
  return toObjects(await client.execute({ sql, args: clean(params) }));
}

/** Run several statements atomically: tx(async (q) => { await q('...', {...}) }) */
async function tx(work) {
  const t = await client.transaction('write');
  try {
    const q = async (sql, params) => toObjects(await t.execute({ sql, args: clean(params) }));
    const out = await work(q);
    await t.commit();
    return out;
  } catch (err) {
    await t.rollback().catch(() => {});
    throw err;
  } finally {
    t.close();
  }
}

/** Create tables + seed plans (idempotent). */
async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'schema.sql'), 'utf8');
  const statements = schema
    .replace(/--.*$/gm, '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  // Older databases: add columns introduced after the first release
  const added = [
    ['Users', 'AdBalance', 'REAL NOT NULL DEFAULT 0'],
    ['Campaigns', 'ReviewStatus', "TEXT NOT NULL DEFAULT 'approved'"],
    ['Campaigns', 'Budget', 'REAL NOT NULL DEFAULT 0'],
    ['Campaigns', 'RejectReason', 'TEXT'],
  ];
  for (const [table, col, def] of added) {
    const cols = await query(`SELECT name FROM pragma_table_info('${table}')`);
    if (cols.length && !cols.some((c) => c.name === col)) await client.execute(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  }
  await client.batch(statements, 'write');
}

module.exports = { query, tx, initDb, client, NOW };
