require('dotenv').config();

const trusted = process.env.DB_TRUSTED === 'true';
const sql = trusted ? require('mssql/msnodesqlv8') : require('mssql');

const config = trusted
  ? {
      connectionString:
        `Driver={${process.env.DB_ODBC_DRIVER || 'ODBC Driver 17 for SQL Server'}};` +
        `Server=${process.env.DB_SERVER};Database=${process.env.DB_DATABASE};Trusted_Connection=yes;`,
    }
  : {
      server: process.env.DB_SERVER,
      port: Number(process.env.DB_PORT || 1433),
      database: process.env.DB_DATABASE,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      // Azure SQL / most hosted MSSQL need DB_ENCRYPT=true
      options: { encrypt: process.env.DB_ENCRYPT === 'true', trustServerCertificate: process.env.DB_ENCRYPT !== 'true' },
    };

let poolPromise;
function getPool() {
  if (!poolPromise) poolPromise = new sql.ConnectionPool(config).connect();
  return poolPromise;
}

function bind(request, params = {}) {
  for (const [k, v] of Object.entries(params)) request.input(k, v);
  return request;
}

/** Run a parameterised query: query('SELECT * FROM Users WHERE Id=@id', { id }) */
async function query(text, params) {
  const pool = await getPool();
  const result = await bind(pool.request(), params).query(text);
  return result.recordset || [];
}

/** Run several statements atomically: tx(async (q) => { await q('...', {...}) }) */
async function tx(work) {
  const pool = await getPool();
  const t = new sql.Transaction(pool);
  await t.begin();
  try {
    const q = async (text, params) =>
      (await bind(new sql.Request(t), params).query(text)).recordset || [];
    const out = await work(q);
    await t.commit();
    return out;
  } catch (err) {
    await t.rollback().catch(() => {});
    throw err;
  }
}

module.exports = { sql, query, tx, getPool };
