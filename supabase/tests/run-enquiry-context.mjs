import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
const db=new PGlite();
try {
  await db.exec(await readFile(new URL('./bootstrap.sql',import.meta.url),'utf8'));
  const dir=new URL('../migrations/',import.meta.url);
  const files=(await readdir(dir)).filter(f=>f.endsWith('.sql')&&!f.includes('enable_enquiry_schedule_extensions')).sort();
  for(const file of files.filter(f=>!f.endsWith('_enquiry_listing_context.sql')))await db.exec(await readFile(new URL(file,dir),'utf8'));
  await db.exec(await readFile(new URL('./enquiry-context-fixture.sql',import.meta.url),'utf8'));
  for(const file of files.filter(f=>f.endsWith('_enquiry_listing_context.sql')))await db.exec(await readFile(new URL(file,dir),'utf8'));
  await db.exec(await readFile(new URL('./enquiry-context.sql',import.meta.url),'utf8'));
  console.log('PASS enquiry context: migration/backfill, UUID/numeric lookup, privacy, permissions, retries and snapshots');
} catch(error) { console.error(error.message); if(error.where)console.error(error.where); process.exitCode=1; }
finally { await db.close(); }
