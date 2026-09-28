import {createClient} from 'npm:@supabase/supabase-js@2.117.0';
import {readSmallJson} from '../_shared/invitation.ts';
import {parseListingInput} from '../_shared/listing-input.ts';
import {parseVideo} from '../_shared/listing-video.ts';
const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
function hasValidAppKey(request:Request){
  const supplied=request.headers.get('apikey');
  if(!supplied)return false;
  const allowed=[Deno.env.get('SUPABASE_ANON_KEY'),Deno.env.get('SUPABASE_PUBLISHABLE_KEY')].filter((key):key is string=>!!key);
  try{const configured=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}') as Record<string,unknown>;allowed.push(...Object.values(configured).filter((key):key is string=>typeof key==='string'));}catch{}
  return allowed.includes(supplied);
}
Deno.serve(async request=>{
  const origin='https://proprieteenvente.ca';
  const requestOrigin=request.headers.get('origin');
  const allowed=[origin,'http://127.0.0.1:5173'];
  const headers={'Access-Control-Allow-Origin':allowed.includes(requestOrigin||'')?requestOrigin!:origin,'Access-Control-Allow-Headers':'content-type,apikey','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store','Vary':'Origin'};
  const reply=(status:number,body:unknown)=>Response.json(body,{status,headers});
  if(!allowed.includes(requestOrigin||''))return reply(403,{error:'forbidden'});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply(405,{error:'method'});
  if(!hasValidAppKey(request))return reply(401,{error:'unauthorized'});
  let input:ReturnType<typeof parseListingInput>, fingerprint:string,video:ReturnType<typeof parseVideo>;
  try{const body=await readSmallJson(request,24*1024*1024);input=parseListingInput(body);video=parseVideo((body as Record<string,unknown>).video);if(video&&(body as Record<string,unknown>).videoConsent!==true)throw Error('consent');fingerprint=await digest(JSON.stringify(body));}
  catch{return reply(400,{error:'invalid'});}
  try{
    const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const salt=Deno.env.get('ENQUIRY_RATE_SALT') || secret;
    if(!secret||!salt)return reply(503,{error:'unavailable'});
    const db=createClient(Deno.env.get('SUPABASE_URL')!,secret,{auth:{persistSession:false}});
    const paths=input.photos.map((photo,i)=>`${input.id}/${i}.${photo.ext}`);
    const clientHash=await digest(salt+(request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown'));
    const reserved=await db.rpc('reserve_listing',{p_id:input.id,p_fingerprint:fingerprint,p_property:input.property,p_contact:input.contact,p_paths:paths,p_client_hash:clientHash});
    if(reserved.error)return reply(reserved.error.message.includes('rate_limit')?429:503,{error:'not_saved'});
    const receipt=await db.from('listing_submissions').select('listing_number').eq('id',input.id).single();
    if(receipt.error||!receipt.data?.listing_number)throw Error('reference_unavailable');
    const reference=String(receipt.data.listing_number);
    if(reserved.data!=='uploading')return reply(200,{ok:true,reference});
    for(let i=0;i<input.photos.length;i++){
      const photo=input.photos[i];
      // Retried uploads are immutable: existing objects are never overwritten.
      const uploaded=await db.storage.from('listing-photos').upload(paths[i],photo.bytes,{contentType:photo.mime,upsert:false});
      if(uploaded.error){const {data:existing,error}=await db.storage.from('listing-photos').download(paths[i]);if(error||!existing)throw Error('upload');const bytes=new Uint8Array(await existing.arrayBuffer());if(bytes.length!==photo.bytes.length||bytes.some((b,j)=>b!==photo.bytes[j]))throw Error('conflict');}
    }
    const videoPath=video?`${input.id}/video.${video.ext}`:null;
    if(video && videoPath){
      const uploaded=await db.storage.from('listing-videos').upload(videoPath,video.bytes,{contentType:video.mime,upsert:false});
      if(uploaded.error){const {data:existing,error}=await db.storage.from('listing-videos').download(videoPath);if(error||!existing)throw Error('video_upload');const bytes=new Uint8Array(await existing.arrayBuffer());if(bytes.length!==video.bytes.length||bytes.some((b,j)=>b!==video.bytes[j]))throw Error('conflict');}
    }
    const saved=await db.from('listing_submissions').update({status:'pending',video_path:videoPath}).eq('id',input.id).eq('status','uploading');
    if(saved.error)throw saved.error;
    return reply(200,{ok:true,reference});
  }catch{return reply(503,{error:'not_saved'});}
});
