import {createClient} from 'npm:@supabase/supabase-js@2.117.0';
import {createRemoteJWKSet,jwtVerify} from 'npm:jose@6.1.0';
import {assertCloudClaims,validateSnapshot,CENTRIS_AUDIENCE,CENTRIS_ISSUER} from '../_shared/centris-cloud.mjs';

const keys=createRemoteJWKSet(new URL(`${CENTRIS_ISSUER}/.well-known/jwks`));
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
Deno.serve(async request=>{
  if(request.method!=='POST')return json({error:'POST required'},405);
  let runId:string;
  try{
    const token=request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];
    if(!token)throw Error('Missing identity');
    const {payload}=await jwtVerify(token,keys,{issuer:CENTRIS_ISSUER,audience:CENTRIS_AUDIENCE,algorithms:['RS256'],requiredClaims:['exp','iat','nbf','sub'],maxTokenAge:'10 minutes',clockTolerance:15});
    runId=assertCloudClaims(payload);
  }catch{return json({error:'Unauthorized cloud workflow'},401);}
  try{
    const text=await request.text();
    if(text.length>1000000)return json({error:'Payload too large'},413);
    const body=JSON.parse(text);
    const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
    if(body.operation==='state'){
      const {data,error}=await db.rpc('centris_cloud_state');
      if(error)throw Error(error.message);
      return json(data);
    }
    if(body.operation!=='apply'||body.runId!==runId||typeof body.expectedVersion!=='string')return json({error:'Invalid operation'},400);
    validateSnapshot(body.snapshot);
    const paths=[...new Set(body.snapshot.cards.flatMap((c:{photoPaths?:string[]})=>c.photoPaths??[]))] as string[];
    // Photos must be deployed before a new record can become public.
    for(let start=0;start<paths.length;start+=10)await Promise.all(paths.slice(start,start+10).map(async path=>{
      const response=await fetch(`https://proprieteenvente.ca${path}`,{method:'HEAD',redirect:'error',signal:AbortSignal.timeout(15000)});
      if(response.status!==200||!response.headers.get('Content-Type')?.startsWith('image/webp'))throw Error('New photos are not deployed');
    }));
    const {data,error}=await db.rpc('apply_centris_cloud_snapshot',{payload:{snapshot:body.snapshot,runId,expectedVersion:body.expectedVersion}});
    if(error)throw Error(error.message);
    return json(data);
  }catch(error){return json({error:error instanceof Error?error.message.slice(0,250):'Sync failed'},400);}
});
