import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {CentrisClient} from './centris-source.mjs';
import {prepareSnapshot} from './centris-plan.mjs';
import {validateSnapshot,CENTRIS_AUDIENCE} from '../supabase/functions/_shared/centris-cloud.mjs';

const endpoint='https://usngcexxobcpjncuwaxo.supabase.co/functions/v1/centris-cloud-sync';
const repository='YuJieMichael/Propriete-En-Vente';
const site='https://proprieteenvente.ca';
const output=process.env.CENTRIS_OUTPUT_DIR||'centris-run';
const runId=`${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`;
const apply=process.env.CENTRIS_APPLY==='true';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
async function save(name,value){await mkdir(output,{recursive:true});await writeFile(`${output}/${name}`,JSON.stringify(value,null,2)+'\n');}
async function cloud(body){
  const url=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
  url.searchParams.set('audience',CENTRIS_AUDIENCE);
  const auth=await fetch(url,{headers:{Authorization:`Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`},signal:AbortSignal.timeout(30000)});
  if(!auth.ok)throw Error(`GitHub OIDC failed (${auth.status})`);
  const {value}=await auth.json();
  console.log(`::add-mask::${value}`);
  const response=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${value}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(180000)});
  const result=await response.json();
  if(!response.ok)throw Error(`Cloud sync: ${result.error||response.status}`);
  return result;
}
async function github(path,method='GET',body){
  const response=await fetch(`https://api.github.com/repos/${repository}${path}`,{method,headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  const data=await response.json();
  if(!response.ok)throw Error(`GitHub ${path}: ${response.status} ${data.message||''}`);
  return data;
}
async function release(paths,phase,summary){
  if(paths.some(path=>!/^frontend\/public\/centris\/\d{7,8}\/\d{3}\.webp$/.test(path)&&path!=='frontend/public/centris-sync.json'))throw Error('Unexpected release file');
  git('fetch','origin','main');
  git('checkout','-B',`cloud/centris-${runId}-${phase}`,'FETCH_HEAD');
  git('config','user.name','github-actions[bot]');
  git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com');
  git('add','--',...paths);
  if(!git('diff','--cached','--name-only'))return null;
  git('commit','-m',`Centris cloud sync ${runId}: ${phase}`);
  const head=git('rev-parse','HEAD');
  const branch=git('branch','--show-current');
  git('push','origin',`HEAD:refs/heads/${branch}`);
  const pr=await github('/pulls','POST',{base:'main',head:branch,title:`Centris daily sync: ${phase} (${new Date().toISOString().slice(0,10)})`,body:`Daily reconciliation for Tian Shu Lu (e6356).\n\n${summary}\n\nValidated source completeness, cloud identity and transaction guards. Only verified listing photos or the deployment marker change in this PR. Automated tests passed before publication.\n\nRun: https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`});
  // Review the actual diff before merging; do not accept unexpected code edits.
  let files=[];
  for(let page=1;page<=30;page++){const batch=await github(`/pulls/${pr.number}/files?per_page=100&page=${page}`);files.push(...batch);if(batch.length<100)break;}
  if(files.length!==paths.length||files.some(f=>!paths.includes(f.filename)||!['added','modified'].includes(f.status)))throw Error(`PR #${pr.number} has unexpected changes`);
  let ready=false;
  for(let attempt=0;attempt<24;attempt++){
    const [pull,checks,status]=await Promise.all([github(`/pulls/${pr.number}`),github(`/commits/${head}/check-runs`),github(`/commits/${head}/status`)]);
    if(pull.head.sha!==head||pull.mergeable===false)throw Error(`PR #${pr.number} changed or conflicts`);
    if(checks.check_runs.some(c=>c.status==='completed'&&!['success','neutral','skipped'].includes(c.conclusion))||status.statuses.some(s=>['error','failure'].includes(s.state)))throw Error(`PR #${pr.number} failed checks`);
    if(pull.mergeable===true&&checks.check_runs.every(c=>c.status==='completed')&&status.statuses.every(s=>s.state==='success')){ready=true;break;}
    await sleep(5000);
  }
  if(!ready)throw Error(`PR #${pr.number} checks did not finish`);
  const merged=await github(`/pulls/${pr.number}/merge`,'PUT',{sha:head,merge_method:'squash'});
  if(merged.merged!==true)throw Error(`PR #${pr.number} did not merge`);
  console.log(`Merged ${pr.html_url} at ${merged.sha}`);
  return {number:pr.number,url:pr.html_url,sha:merged.sha};
}
async function waitFor(check,label){
  for(let attempt=0;attempt<60;attempt++){try{if(await check())return;}catch{}await sleep(15000);}
  throw Error(`${label} not visible on production after 15 minutes`);
}
async function downloadPhotos(photos){
  const paths=[];
  for(const photo of photos){
    const url=new URL(photo.url);url.searchParams.set('w','1600');url.searchParams.set('h','1200');
    const response=await fetch(url,{signal:AbortSignal.timeout(30000),redirect:'error'});
    if(!response.ok||!response.headers.get('Content-Type')?.startsWith('image/'))throw Error('Source photo failed');
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.length>20e6)throw Error('Source photo too large');
    const image=await sharp(bytes,{limitInputPixels:40000000}).resize({width:1600,height:1200,fit:'inside',withoutEnlargement:true}).webp({quality:80}).toBuffer();
    const metadata=await sharp(image).metadata();if(metadata.width<100||metadata.height<100)throw Error('Invalid source photo dimensions');
    const path=`frontend/public${photo.path}`;await mkdir(dirname(path),{recursive:true});await writeFile(path,image);paths.push(path);
  }
  return paths;
}
async function verifyProduction(state){
  const sitemap=await fetch(`${site}/sitemap.xml`,{cache:'no-store',signal:AbortSignal.timeout(30000)}).then(r=>{if(!r.ok)throw Error('Sitemap unavailable');return r.text();});
  let pages=0,photos=0;
  for(const row of state.rows){
    if(!row.published){if(row.auto_withdrawn&&sitemap.includes(`/proprietes/${row.listing_number}/`))throw Error('Withdrawn listing remains in sitemap');continue;}
    for(const lang of ['fr','en','zh']){
      const url=`${site}/${lang}/proprietes/${row.listing_number}/`;
      const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(30000)});const html=await response.text();
      if(!response.ok||!sitemap.includes(url))throw Error(`Missing published page ${row.listing_number}/${lang}`);
      const blocks=[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
      const text=JSON.stringify(blocks);
      if(!text.includes(`"price":${row.property.price}`)&&!text.includes(`"price":"${row.property.price}"`))throw Error(`Stale SEO price ${row.listing_number}/${lang}`);
      pages++;
    }
    const response=await fetch(`${site}${row.photo_paths[0]}`,{method:'HEAD',signal:AbortSignal.timeout(15000)});
    if(!response.ok||!response.headers.get('Content-Type')?.startsWith('image/webp'))throw Error(`Missing cover ${row.listing_number}`);
    photos++;
  }
  return {pages,coverPhotos:photos,sitemap:true};
}

async function main(){
  if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REPOSITORY!==repository||process.env.GITHUB_REF!=='refs/heads/main')throw Error('Run only from the main GitHub Actions workflow');
  const client=new CentrisClient();
  const source=await client.catalogue();
  const state=await cloud({operation:'state'});
  const plan=await prepareSnapshot(source,state,client);
  validateSnapshot(plan.snapshot);
  console.log('Reconciliation',JSON.stringify(plan.summary));
  await save('source.json',plan.snapshot);
  await save('plan.json',plan.summary);
  if(!apply){
    const verification=await verifyProduction(state);
    const result={mode:'dry-run',...plan.summary,verification};await save('result.json',result);
    console.log(JSON.stringify(result));return result;
  }
  const releases=[];
  const imagePaths=await downloadPhotos(plan.newPhotos);
  if(imagePaths.length){
    releases.push(await release(imagePaths,'photos',`${imagePaths.length} verified source photos, before database publication.`));
    await waitFor(async()=>{
      const checks=await Promise.all(plan.newPhotos.map(p=>fetch(site+p.path,{method:'HEAD',signal:AbortSignal.timeout(10000)}).then(r=>r.ok&&r.headers.get('Content-Type')?.startsWith('image/webp'))));
      return checks.every(Boolean);
    },'New photos');
  }
  const result=await cloud({operation:'apply',runId,expectedVersion:state.version,snapshot:plan.snapshot});
  await save('database-result.json',result);
  const marker={runId,capturedAt:source.capturedAt,activeSourceCount:source.total,sourceDigest:createHash('sha256').update(JSON.stringify(plan.snapshot.cards.map(c=>[c.sourceId,c.price,c.rentPrice]))).digest('hex')};
  // Commit after the database transaction, so Cloudflare's SEO build reads new values.
  git('fetch','origin','main');git('checkout','-B',`cloud/centris-${runId}-publish`,'FETCH_HEAD');
  await writeFile('frontend/public/centris-sync.json',JSON.stringify(marker,null,2)+'\n');
  releases.push(await release(['frontend/public/centris-sync.json'],'publish',JSON.stringify(result)));
  await waitFor(async()=>{const r=await fetch(`${site}/centris-sync.json`,{cache:'no-store',signal:AbortSignal.timeout(10000)});return r.ok&&(await r.json()).runId===runId;},'Cloudflare release');
  const after=await cloud({operation:'state'});
  const verification=await verifyProduction(after);
  const final={mode:'apply',...result,releases,verification};await save('result.json',final);
  console.log(JSON.stringify(final));return final;
}
try{
  const result=await main();
  if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,`## Centris cloud sync\n\n\`\`\`json\n${JSON.stringify(result,null,2)}\n\`\`\`\n`);
}catch(error){console.error(error.message);await save('failure.json',{error:error.message,runId,time:new Date().toISOString()});process.exitCode=1;}
