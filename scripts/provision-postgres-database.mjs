#!/usr/bin/env node
/**
 * Cria uma base PostgreSQL se não existir (sem DROP).
 * Uso: node scripts/provision-postgres-database.mjs fintwin_demo_ui
 */
import pg from "pg";

const database = process.argv[2];
if (!database || !/^[a-z][a-z0-9_]*$/i.test(database)) {
  console.error("Uso: node scripts/provision-postgres-database.mjs <nome_base>");
  process.exit(1);
}

const blocked = /(backup|restore|prod|production|primary|replica)/i;
if (blocked.test(database)) {
  console.error(`Nome de base bloqueado: ${database}`);
  process.exit(1);
}

const adminUrl =
  process.env.FINTWIN_PG_ADMIN_URL ??
  "postgresql://fintwin:fintwin@localhost:5433/postgres";

const client = new pg.Client({ connectionString: adminUrl });
await client.connect();

const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [
  database,
]);

if (exists.rowCount === 0) {
  await client.query(`CREATE DATABASE "${database.replace(/"/g, '""')}"`);
  console.log(`Base criada: ${database}`);
} else {
  console.log(`Base já existe: ${database}`);
}

await client.end();
