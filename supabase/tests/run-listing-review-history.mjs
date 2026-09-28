import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
const db=new PGlite();
try{
 await db.exec(await readFile(new URL('./bootstrap.sql',import.meta.url),'utf8'));
 const dir=new URL('../migrations/',import.meta.url);
 for(const file of (await readdir(dir)).filter(x=>x.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
 for(const file of ['listings.sql','listing-videos.sql','listing-references.sql','listing-review-history.sql']){
  await db.exec(await readFile(new URL(file,import.meta.url),'utf8'));console.log(`PASS ${file}`);
 }
}finally{await db.close();}
