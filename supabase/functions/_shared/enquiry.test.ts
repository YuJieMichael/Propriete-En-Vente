import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEnquiry } from './enquiry.ts';
import { createEnquiryNotificationHandler } from './enquiry-notification-handler.ts';

const buyer = {
  requestId: '00000000-0000-4000-8000-000000000001',
  kind: 'buyer',
  language: 'fr',
  name: 'Internal regression test',
  email: 'test@example.test',
};

test('property enquiries accept the public numeric reference and legacy UUID reference', () => {
  for (const listingReference of [
    '100005',
    '100001',
    '00000000-0000-4000-8000-000000000002',
    'A43FAB81-C653-4CB0-94B0-1F987C6E4352',
  ]) {
    assert.equal(parseEnquiry({ ...buyer, listingReference }).listingReference, listingReference);
  }
  assert.equal(parseEnquiry(buyer).listingReference, '');
});

test('property enquiries reject malformed, overlong and control-character references', () => {
  for (const listingReference of [
    'ref100005',
    '100-005',
    '100 005',
    'deadbeef',
    '--------',
    '00000000-0000-4000-8000-00000000000',
    '00000000-0000-4000-8000-00000000000g',
    '1'.repeat(37),
    '100\u0000005',
    '100\n005',
  ]) assert.throws(() => parseEnquiry({ ...buyer, listingReference }), /invalid/);
});

function notificationSetup(options: {rows?: number; empty?: boolean; configured?: boolean; providerOk?: boolean; completeOk?: boolean} = {}) {
  const calls: {name: string; args?: any}[] = [];
  const row = {...buyer, listingReference:'100005', name:'=SUM(1,2)', created_at:'2026-10-16T12:00:00Z'};
  const batch = {id:'00000000-0000-4000-8000-000000000010', rows:Array.from({length:options.rows??1},()=>row)};
  const handler=createEnquiryNotificationHandler({
    env:name=>({ENQUIRY_CRON_TOKEN:'test-cron-token',RESEND_API_KEY:options.configured===false?undefined:'test-mail-key',ENQUIRY_EMAIL_FROM:'notifications@example.test',SUPABASE_URL:'https://project.example.test',SUPABASE_SERVICE_ROLE_KEY:'test-server-key'})[name],
    createClient:()=>({rpc:async(name:string,args?:unknown)=>{
      calls.push({name,args});
      return name==='claim_enquiry_batch'?{data:options.empty?null:batch,error:null}:{data:null,error:options.completeOk===false?{message:'test completion failure'}:null};
    }}),
    fetch:async(_url,init)=>{
      calls.push({name:'email',args:{headers:init!.headers,body:JSON.parse(init!.body as string)}});
      return Response.json({id:'provider-test'},{status:options.providerOk===false?503:200});
    },
  });
  return {calls,batch,request:(token='test-cron-token')=>handler(new Request('https://project.example.test/functions/v1/send-enquiry-batches',{method:'POST',headers:{Authorization:`Bearer ${token}`}}))};
}

test('each notification contains one enquiry, the fixed recipient and a stable retry key',async()=>{
  const {calls,batch,request}=notificationSetup();
  assert.equal((await request()).status,200);
  assert.equal((await request()).status,200);
  const emails=calls.filter(call=>call.name==='email');
  assert.equal(emails.length,2);
  for(const email of emails){
    assert.deepEqual(email.args.body.to,['achat.vente.garderie@gmail.com']);
    assert.equal(email.args.headers['Idempotency-Key'],`enquiry-batch/${batch.id}`);
    assert.match(email.args.body.subject,/New enquiry/);
    assert.doesNotMatch(email.args.body.subject,/10 (demandes|enquiries)/);
    const csv=Buffer.from(email.args.body.attachments[0].content,'base64').toString('utf8');
    assert.equal(csv.trim().split('\r\n').length,2);
    assert.match(csv,/'=SUM\(1,2\)/);
    assert.match(csv,/100005/);
  }
  assert.deepEqual(calls.filter(call=>call.name==='complete_enquiry_batch').map(call=>call.args),[
    {p_id:batch.id,p_provider_id:'provider-test'},
    {p_id:batch.id,p_provider_id:'provider-test'},
  ]);
});

test('notification worker refuses multi-enquiry batches and preserves pending failures',async()=>{
  for(const options of [{rows:10},{providerOk:false},{completeOk:false}]){
    const {calls,request}=notificationSetup(options);
    const response=await request();
    assert.equal(response.status,503);
    assert.deepEqual(await response.json(),{error:'batch_pending_retry'});
    if('rows' in options) assert.equal(calls.filter(call=>call.name==='email').length,0);
    if('providerOk' in options) assert.equal(calls.filter(call=>call.name==='complete_enquiry_batch').length,0);
  }
});

test('notification worker checks private authorization and sender before claiming',async()=>{
  const unauthorized=notificationSetup();
  assert.equal((await unauthorized.request('wrong-token')).status,401);
  assert.equal(unauthorized.calls.length,0);
  const unconfigured=notificationSetup({configured:false});
  assert.equal((await unconfigured.request()).status,503);
  assert.equal(unconfigured.calls.length,0);
  const empty=notificationSetup({empty:true});
  assert.deepEqual(await (await empty.request()).json(),{ok:true,batches:0});
  assert.equal(empty.calls.filter(call=>call.name==='email').length,0);
});
