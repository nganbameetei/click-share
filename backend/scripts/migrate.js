/* Applies database/schema.sql to the database in .env (safe to run on every deploy).
   Skips CREATE DATABASE / USE so it works on hosted MSSQL (Azure SQL, etc.). */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getPool } = require('../src/db');

(async () => {
  const sqlText = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'schema.sql'), 'utf8');
  const batches = sqlText
    .split(/^\s*GO\s*$/im)
    .map((b) => b.trim())
    .filter((b) => b && !/^(\/\*[\s\S]*?\*\/\s*)?(IF DB_ID|USE )/i.test(b));
  const pool = await getPool();
  for (const b of batches) await pool.request().batch(b);
  console.log(`Migration complete (${batches.length} batches).`);
  await pool.close();
})().catch((e) => { console.error('Migration failed:', e.message); process.exit(1); });
