import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
const db=new PGlite();
try{
 await db.exec(await readFile(new URL('./bootstrap.sql',import.meta.url),'utf8'));
 const dir=new URL('../migrations/',import.meta.url);
 for(const file of (await readdir(dir)).filter(x=>x.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
 await db.exec(await readFile(new URL('./buyer-enquiry-actions.sql',import.meta.url),'utf8'));
 console.log('PASS buyer enquiry acceptance, deletion, restoration, filtering, batching, audit and role/revision checks');
}finally{await db.close();}
