// Generate schematic GLB models for listings from reviewed spec files.
// Usage: node scripts/listing-models/generate.mjs [reference ...]
// Specs live in scripts/listing-models/specs/<reference>.json. Each spec names
// a template per scene, the parameters observed in the listing photos, and the
// photos to attach to each template anchor. Output:
//   frontend/public/models/<reference>/<scene>-v<version>.glb
//   frontend/src/generated-listing-models.json (registry read by the site)
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {templates} from './templates.mjs';
const require=createRequire(new URL('../../frontend/package.json',import.meta.url));
const {GLTFExporter}=await import(pathToFileURL(require.resolve('three/addons/exporters/GLTFExporter.js')).href);
globalThis.FileReader=class {readAsArrayBuffer(blob){void blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.();});}};

const root=new URL('../../',import.meta.url);
const specDir=new URL('scripts/listing-models/specs/',root);
const registryPath=fileURLToPath(new URL('frontend/src/generated-listing-models.json',root));
const photoRe=/^\/(?:centris|editorial)\/[A-Za-z0-9_-]+\/\d{3}\.webp$/;

function fail(msg){throw new Error(msg);}
async function photoExists(src){try{await fs.access(fileURLToPath(new URL('frontend/public'+src,root)));return true;}catch{return false;}}

async function build(spec){
  if(!/^\d{6}$/.test(spec.reference))fail('bad reference');
  if(!spec.sourceId)fail(`${spec.reference}: sourceId required`);
  const out=new URL(`frontend/public/models/${spec.reference}/`,root);
  await fs.mkdir(out,{recursive:true});
  const models=[];
  for(const scene of spec.scenes){
    const make=templates[scene.template]||fail(`${spec.reference}: unknown template ${scene.template}`);
    const {group,anchors}=make({...scene.params,meta:{listingReference:spec.reference,sourcePhotos:`/centris/${spec.sourceId}`}});
    const file=`${scene.id}-v${spec.version??1}.glb`;
    const glb=await new GLTFExporter().parseAsync(group,{binary:true,onlyVisible:true});
    await fs.writeFile(new URL(file,out),Buffer.from(glb));
    const hotspots=[];
    for(const h of scene.hotspots||[]){
      const anchor=anchors[h.anchor]||fail(`${spec.reference}/${scene.id}: unknown anchor ${h.anchor}`);
      for(const src of h.photos){if(!photoRe.test(src)||!await photoExists(src))fail(`${spec.reference}: missing photo ${src}`);}
      hotspots.push({id:h.id,label:h.label,position:anchor.position.map(n=>Math.round(n*100)/100),normal:anchor.normal,photos:h.photos,illustrative:false});
    }
    models.push({src:`/models/${spec.reference}/${file}`,area:scene.area,label:scene.label,illustrative:true,schematic:true,hotspots});
    console.log(`${spec.reference} ${file}: ${glb.byteLength} bytes, ${hotspots.length} points`);
  }
  return {sourceId:spec.sourceId,models};
}

const wanted=process.argv.slice(2);
const files=(await fs.readdir(specDir)).filter(f=>f.endsWith('.json')).sort();
let registry={};
try{registry=JSON.parse(await fs.readFile(registryPath,'utf8'));}catch{}
for(const f of files){
  const spec=JSON.parse(await fs.readFile(new URL(f,specDir),'utf8'));
  if(wanted.length&&!wanted.includes(spec.reference))continue;
  registry[spec.reference]=await build(spec);
}
const sorted=Object.fromEntries(Object.entries(registry).sort(([a],[b])=>a.localeCompare(b)));
await fs.writeFile(registryPath,JSON.stringify(sorted,null,1)+'\n');
console.log(`registry: ${Object.keys(sorted).length} listing(s)`);
