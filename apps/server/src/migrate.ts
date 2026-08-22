import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required to run migrations');
}

const migrationsDirectory = fileURLToPath(
  new URL('../../../database/migrations/', import.meta.url),
);
const pool = new pg.Pool({ connectionString, max: 1 });
const client = await pool.connect();

try {
  await client.query('begin');
  await client.query('select pg_advisory_xact_lock(742019)');
  await client.query(`
    create table if not exists public.schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const files = (await readdir(migrationsDirectory))
    .filter((name) => name.endsWith('.sql'))
    .sort();

  for (const name of files) {
    const applied = await client.query(
      'select 1 from public.schema_migrations where name = $1',
      [name],
    );
    if (applied.rowCount) continue;

    await client.query(
      await readFile(`${migrationsDirectory}/${name}`, 'utf8'),
    );
    await client.query(
      'insert into public.schema_migrations (name) values ($1)',
      [name],
    );
    console.log(`Applied migration ${name}`);
  }

  await client.query('commit');
} catch (error) {
  await client.query('rollback');
  throw error;
} finally {
  client.release();
  await pool.end();
}
