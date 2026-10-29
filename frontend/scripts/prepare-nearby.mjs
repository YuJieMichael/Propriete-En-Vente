// Looks up nearby everyday places for each published listing and saves them as
// static files (public/nearby/<reference>.json). The public Overpass servers are
// often slow, so this runs by hand after new listings are published, not in the
// build or in visitors' browsers. Usage: node scripts/prepare-nearby.mjs [--refresh]
import {access,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadEnv} from 'vite';
import {createClient} from '@supabase/supabase-js';
import {overpassQuery,summarize} from '../src/lib/nearby.ts';

const frontend=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(frontend,'public/nearby');
const env={...loadEnv('production',frontend,''),...process.env};
const refresh=process.argv.includes('--refresh');
const client=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data,error}=await client.from('published_listings').select('listing_number,property').order('listing_number').limit(1000);
if(error)throw Error(`Public catalogue could not be read: ${error.message}`);
await mkdir(output,{recursive:true});
// Overpass asks clients to identify themselves and to send one request at a time.
const headers={'User-Agent':'Propriete-En-Vente nearby-places/1.0 (+https://proprieteenvente.ca)'};
async function query(lat,lon){
  for(let attempt=1;attempt<=3;attempt++){
    try{
      const response=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers,body:new URLSearchParams({data:overpassQuery(lat,lon)}),signal:AbortSignal.timeout(90_000)});
      if(response.ok)return (await response.json()).elements??[];
      console.warn(`  HTTP ${response.status}, attempt ${attempt}`);
    }catch(error){console.warn(`  ${error.name}, attempt ${attempt}`);}
    await new Promise(resolve=>setTimeout(resolve,attempt*15_000));
  }
  return null;
}
let saved=0,skipped=0,failed=0;
for(const row of data){
  const reference=String(row.listing_number),coordinates=row.property?.coordinates;
  const file=path.join(output,`${reference}.json`);
  if(!coordinates||row.property?.source?.locationStatus==='unverified'){skipped++;continue;}
  if(!refresh&&await access(file).then(()=>true,()=>false)){skipped++;continue;}
  console.log(`${reference} ${row.property.city}`);
  const elements=await query(coordinates.latitude,coordinates.longitude);
  if(!elements){failed++;continue;}
  const summary=summarize(coordinates.latitude,coordinates.longitude,elements);
  await writeFile(file,JSON.stringify({checked:new Date().toISOString().slice(0,10),...summary})+'\n');
  saved++;
}
console.log(`Nearby places: ${saved} saved, ${skipped} skipped, ${failed} failed.`);
if(failed)process.exitCode=1;
