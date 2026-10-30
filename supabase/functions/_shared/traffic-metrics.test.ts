import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrafficMetricsHandler,trafficEvent,trafficClientHash} from './traffic-metrics.ts';

function setup(){
  const calls:{name:string;args:Record<string,unknown>}[]=[];
  const handler=createTrafficMetricsHandler({
    env:name=>({SUPABASE_URL:'https://project.example.test',SUPABASE_SERVICE_ROLE_KEY:'test-server-key',SUPABASE_PUBLISHABLE_KEYS:'{"default":"sb_publishable_test"}'})[name],
    createClient:()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:true,error:null};}}),
    now:()=>new Date('2026-10-28T12:00:00Z'),
  });
  const request=(body:unknown,origin='https://proprieteenvente.ca',key='sb_publishable_test')=>new Request('https://project.example.test/functions/v1/record-traffic',{method:'POST',headers:{origin,apikey:key,'content-type':'application/json','x-forwarded-for':'192.0.2.1'},body:JSON.stringify(body)});
  return {handler,calls,request};
}
test('public intake rejects private payload fields and forged enquiry-success events',()=>{
  for(const payload of [{event:'enquiry_success',source:'facebook'},{event:'site_visit',source:'facebook',email:'private@example.test'},{event:'site_visit',source:'facebook',url:'https://example.test/?token=secret'},{event:'property_view',reference:'private-project'},{event:'site_visit',source:'unbounded-campaign'}])assert.equal(trafficEvent(payload),null);
});
test('traffic gateway verifies app key and exact origin before recording',async()=>{
  const {handler,calls,request}=setup();
  assert.equal((await handler(request({event:'site_visit'},'https://evil.example.test'))).status,403);
  assert.equal((await handler(request({event:'site_visit'},'https://proprieteenvente.ca','bad-key'))).status,401);
  assert.equal(calls.length,0);
});
test('local preview validates the contract without writing production traffic',async()=>{
  const {handler,calls,request}=setup();
  const response=await handler(request({event:'property_view',reference:'100001',source:'facebook'},'http://127.0.0.1:5173'));
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:false});assert.equal(calls.length,0);
});
test('production records only bounded source, public reference and a server-side abuse hash',async()=>{
  const {handler,calls,request}=setup();
  const response=await handler(request({event:'property_view',reference:'100001',source:'facebook'}));
  assert.deepEqual(await response.json(),{ok:true});assert.equal(calls.length,1);
  assert.equal(calls[0].name,'record_site_metric');
  assert.deepEqual(Object.keys(calls[0].args).sort(),['p_client_hash','p_event','p_reference','p_source']);
  assert.match(String(calls[0].args.p_client_hash),/^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(calls).includes('192.0.2.1'));
});
test('abuse hashes rotate with the Québec day and secret',async()=>{
  const one=await trafficClientHash('test-a','192.0.2.1',new Date('2026-10-28T12:00:00Z'));
  assert.equal(one,await trafficClientHash('test-a','192.0.2.1',new Date('2026-10-28T13:00:00Z')));
  assert.notEqual(one,await trafficClientHash('test-a','192.0.2.1',new Date('2026-10-29T12:00:00Z')));
  assert.notEqual(one,await trafficClientHash('test-b','192.0.2.1',new Date('2026-10-28T12:00:00Z')));
});
