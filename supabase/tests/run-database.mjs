import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = path.resolve(testsDirectory, '../migrations');
const database = new PGlite();

try {
  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  const files = [
    path.join(testsDirectory, 'bootstrap.sql'),
    ...migrationFiles.map((name) => path.join(migrationsDirectory, name)),
    path.join(testsDirectory, 'permissions.sql'),
    path.join(testsDirectory, 'enquiries.sql'),
    path.join(testsDirectory, 'listings.sql'),
    path.join(testsDirectory, 'listing-videos.sql'),
    path.join(testsDirectory, 'staff-email.sql'),
    path.join(testsDirectory, 'buyer-inbox.sql'),
    path.join(testsDirectory, 'multiple-projects.sql'),
    path.join(testsDirectory, 'broker-removal.sql'),
  ];
  for (const file of files) {
    try {
      await database.exec(await readFile(file, 'utf8'));
      process.stdout.write(`PASS ${path.relative(path.resolve(testsDirectory, '..'), file)}\n`);
    } catch (error) {
      process.stderr.write(`FAIL ${file}\n${error.message}\n`);
      if (error.detail) process.stderr.write(`DETAIL: ${error.detail}\n`);
      if (error.where) process.stderr.write(`CONTEXT: ${error.where}\n`);
      throw error;
    }
  }
  process.stdout.write('Database integration assertions passed (disposable PGlite database).\n');
} catch {
  process.exitCode = 1;
} finally {
  await database.close();
}
