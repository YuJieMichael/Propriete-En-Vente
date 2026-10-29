// Creates 640 px card thumbnails next to imported listing cover photos:
//   public/centris/{listing}/001.webp -> public/centris/{listing}/001-640w.webp
// Run after importing listings: `node scripts/make-photo-thumbnails.mjs`
// Needs ffmpeg on PATH (or FFMPEG=/path/to/ffmpeg). Existing thumbnails are kept.
// Cards fall back to the full photo when a thumbnail is missing.
import {readdir,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public/centris');
const ffmpeg=process.env.FFMPEG||'ffmpeg';
const exists=file=>access(file).then(()=>true,()=>false);
let made=0,kept=0;
for(const listing of await readdir(root)){
  if(!/^\d{7,8}$/.test(listing))continue;
  const source=path.join(root,listing,'001.webp'),target=path.join(root,listing,'001-640w.webp');
  if(!await exists(source))continue;
  if(await exists(target)){kept++;continue;}
  const result=spawnSync(ffmpeg,['-loglevel','error','-y','-i',source,'-vf','scale=640:-2','-c:v','libwebp','-quality','72',target],{stdio:'inherit'});
  if(result.status!==0)throw Error(`ffmpeg failed for ${source}${result.error?`: ${result.error.message}`:''}`);
  made++;
}
console.log(`Card thumbnails: ${made} created, ${kept} already present.`);
