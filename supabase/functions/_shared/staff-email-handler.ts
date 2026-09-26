import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.0';
import { appointmentConfig, readSmallJson } from './invitation.ts';

type Runtime = {
  env: (name: string) => string | undefined;
  createClient: (url: string, secret: string) => SupabaseClient;
  fetch: typeof fetch;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function randomCode() {
  // Rejection sampling avoids modulo bias.
  let n: number;
  do { n=crypto.getRandomValues(new Uint32Array(1))[0]; } while(n>=4294000000);
  return String(n % 1000000).padStart(6,'0');
}
async function digest(secret: string, user: string, session: string, challenge: string, code: string) {
  const bytes=new TextEncoder();
  const key=await crypto.subtle.importKey('raw',bytes.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=await crypto.subtle.sign('HMAC',key,bytes.encode(JSON.stringify(['staff-email-v1',user,session,challenge,code])));
  return Array.from(new Uint8Array(signature),b=>b.toString(16).padStart(2,'0')).join('');
}
export function createStaffEmailHandler(runtime: Runtime) {
  return async (request: Request) => {
    let origin: string;
    try { origin=appointmentConfig(runtime.env('APP_ORIGIN')).origin; }
    catch { return Response.json({error:'service_unavailable'},{status:503}); }
    const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store','Vary':'Origin'};
    const reply=(status: number,body: object)=>Response.json(body,{status,headers});
    if(request.headers.get('origin') && request.headers.get('origin')!==origin) return reply(403,{error:'forbidden'});
    if(request.method==='OPTIONS') return new Response(null,{status:204,headers});
    if(request.method!=='POST') return reply(405,{error:'method_not_allowed'});
    try {
      const secret=runtime.env('SUPABASE_SERVICE_ROLE_KEY') || runtime.env('SUPABASE_SECRET_KEY');
      const url=runtime.env('SUPABASE_URL');
      if(!secret || !url) return reply(503,{error:'service_unavailable'});
      const token=request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
      if(!token || token.length>16384) return reply(401,{error:'authentication_required'});
      const db=runtime.createClient(url,secret);
      const [{data:identity,error:identityError},{data:verified,error:claimError}]=await Promise.all([db.auth.getUser(token),db.auth.getClaims(token)]);
      const user=identity?.user, claims=verified?.claims;
      if(identityError || claimError || !user || claims?.sub!==user.id || typeof claims.session_id!=='string' || !uuid.test(claims.session_id)) return reply(401,{error:'authentication_required'});
      if(!user.email || !user.email_confirmed_at) return reply(403,{error:'forbidden'});
      const {data:staff,error:staffError}=await db.from('staff_members').select('active').eq('user_id',user.id).maybeSingle();
      if(staffError || !staff?.active) return reply(403,{error:'forbidden'});
      let body: {action?: unknown; code?: unknown; challengeId?: unknown; language?: unknown};
      try { body=await readSmallJson(request) as typeof body; }
      catch { return reply(400,{error:'invalid_request'}); }
      if(!body || typeof body!=='object' || Array.isArray(body)) return reply(400,{error:'invalid_request'});
      const hmacSecret=runtime.env('STAFF_EMAIL_HASH_SECRET') || secret;
      if(body.action==='send') {
        const apiKey=runtime.env('RESEND_API_KEY'),from=runtime.env('STAFF_EMAIL_FROM');
        if(!apiKey || !from) return reply(503,{error:'email_not_configured'});
        const code=randomCode(),challengeId=crypto.randomUUID();
        const hash=await digest(hmacSecret,user.id,claims.session_id,challengeId,code);
        const {data:result,error}=await db.rpc('begin_staff_email_check',{p_user_id:user.id,p_session_id:claims.session_id,p_hash:hash,p_challenge_id:challengeId});
        if(error) return reply(503,{error:'service_unavailable'});
        if(result==='rate_limited') return reply(429,{error:'rate_limited'});
        if(result!=='ok') return reply(403,{error:'forbidden'});
        const texts={
          en:[`Propriété En Vente — administrator verification code`,`Your administrator verification code: ${code}\nExpires in 10 minutes. Do not share this code. If you did not request it, ignore this email.`],
          fr:[`Propriété En Vente — code de vérification administrateur`,`Votre code de vérification administrateur : ${code}\nValide pendant 10 minutes. Ne partagez pas ce code. Si vous n’avez pas demandé ce code, ignorez ce courriel.`],
          zh:[`Propriété En Vente — 管理员验证码`,`您的管理员验证码：${code}\n10 分钟内有效，请勿向他人提供。如果不是您本人操作，请忽略此邮件。`],
        };
        const lang=body.language==='en' || body.language==='zh' ? body.language : 'fr';
        const response=await runtime.fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`staff-check/${challengeId}`},body:JSON.stringify({from,to:[user.email],subject:texts[lang][0],text:texts[lang][1]}),signal:AbortSignal.timeout(15000)});
        if(!response.ok) return reply(503,{error:'delivery_failed'});
        const delivered=await response.json();
        if(typeof delivered.id!=='string' || !delivered.id) return reply(503,{error:'delivery_failed'});
        return reply(200,{ok:true,challengeId});
      }
      if(body.action==='verify' && typeof body.code==='string' && /^\d{6}$/.test(body.code) && typeof body.challengeId==='string' && uuid.test(body.challengeId)) {
        const hash=await digest(hmacSecret,user.id,claims.session_id,body.challengeId,body.code);
        const {data:ok,error}=await db.rpc('finish_staff_email_check',{p_user_id:user.id,p_session_id:claims.session_id,p_hash:hash,p_challenge_id:body.challengeId});
        if(error) return reply(503,{error:'service_unavailable'});
        return ok===true ? reply(200,{ok:true}) : reply(400,{error:'invalid_code'});
      }
      return reply(400,{error:'invalid_request'});
    } catch { return reply(503,{error:'service_unavailable'}); }
  };
}
