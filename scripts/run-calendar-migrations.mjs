import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';

const files = [
  'sql/migrations/001_member_calendar.sql',
  'sql/migrations/002_member_calendar_public.sql',
  'sql/migrations/003_member_calendar_subscribers.sql',
];

const connStr = (process.env.DATABASE_URL || '').replace(/[?&]schema=[^&]+/, '');
if (!connStr) {
  console.error('DATABASE_URL missing');
  process.exit(1);
}

const client = new pg.Client({ connectionString: connStr });
await client.connect();
console.log('Connected to database.');

try {
  for (const rel of files) {
    const abs = path.resolve(process.cwd(), rel);
    const sql = fs.readFileSync(abs, 'utf8');
    process.stdout.write(`→ ${rel} ... `);
    await client.query(sql);
    console.log('OK');
  }
  console.log('All migrations applied.');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
