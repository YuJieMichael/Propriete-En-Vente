import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../../frontend/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const card={propertyType:'condo',city:'Montréal',budgetMin:300000,budgetMax:600000,beds:2,parking:true,transaction:'sale',timeline:'3-months'};
async function role(name,user,aal='aal1'){
  await db.exec(`reset role;set role ${name}`);
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:name,...(user?{sub:id(user),aal}:{} )})]);
}
async function rpc(name,args=[]){return (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args)).rows.map(row=>row.value);}
async function fails(fn,match){let caught;try{await fn();}catch(error){caught=error;}assert.ok(caught,'expected an error');assert.match(caught.message,match);}
async function create(n,criteria=card,consent=true){return rpc('create_wanted_request',[id(n),JSON.stringify(criteria),consent]);}
try{
  await db.exec(await readFile(new URL('./bootstrap.sql',import.meta.url),'utf8'));
  const dir=new URL('../migrations/',import.meta.url);
  const migrations=(await readdir(dir)).filter(name=>name.endsWith('.sql')&&!name.includes('enable_enquiry_schedule_extensions')).sort();
  for(const name of migrations)await db.exec(await readFile(new URL(name,dir),'utf8'));
  for(let n=1;n<=20;n++)await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)',[id(n),`user${n}@example.test`,n===5?null:new Date().toISOString()]);
  await db.exec('alter table auth.users add column is_anonymous boolean default false');
  await db.query('update auth.users set is_anonymous=true where id=$1',[id(6)]);
  await db.query("insert into public.staff_members(user_id,role) values($1,'owner')",[id(4)]);
  await role('anon');
  assert.deepEqual(await rpc('list_wanted_requests'),[]);
  await fails(()=>create(101),/permission denied/);
  await fails(()=>db.query('select * from private.wanted_requests'),/permission denied/);
  await fails(()=>db.query("select private.wanted_action('mine')"),/permission denied/);
  await role('authenticated',5);
  await fails(()=>create(101),/verified_sign_in_required/);
  await role('authenticated',6);await fails(()=>create(101),/verified_sign_in_required/);
  await db.exec('reset role');await db.query('update auth.users set is_anonymous=false where id=$1',[id(6)]);
  await role('authenticated',1);
  await fails(()=>db.query('select * from private.wanted_requests'),/permission denied/);
  await fails(()=>create(101,card,false),/consent_required/);
  await fails(()=>create(101,{...card,email:'must-not-publish@example.test'}),/invalid/);
  await fails(()=>create(101,{...card,city:'555-5555 / personal address'}),/invalid/);
  await fails(()=>create(101,{...card,budgetMin:700000}),/invalid/);
  await fails(()=>create(101,{...card,beds:-1}),/invalid/);
  await fails(()=>create(101,{...card,propertyType:'hotel-motel',beds:2}),/invalid/);
  await fails(()=>create(101,{...card,parking:'call me'}),/invalid/);
  await create(101);await create(101);
  assert.equal((await rpc('get_my_wanted_requests')).length,1,'idempotent creation');
  await fails(()=>create(101,{...card,beds:3}),/conflict/);
  assert.equal((await rpc('get_my_wanted_requests'))[0].status,'pending');
  await role('anon');assert.equal((await rpc('list_wanted_requests')).length,0,'pending is not public');
  await role('authenticated',2);assert.equal((await rpc('get_my_wanted_requests')).length,0);
  await fails(()=>rpc('withdraw_wanted_request',[id(101)]),/not_found/);
  await fails(()=>rpc('review_wanted_request',[id(101),0,'published','']),/staff_mfa_required/);
  await role('authenticated',4);await fails(()=>rpc('list_wanted_review'),/staff_mfa_required/);
  await role('authenticated',4,'aal2');
  assert.equal((await rpc('list_wanted_review'))[0].id,id(101));
  await rpc('review_wanted_request',[id(101),0,'published','private note containing staff details']);
  await fails(()=>rpc('review_wanted_request',[id(101),0,'rejected','']),/conflict/);
  await role('anon');const pub=(await rpc('list_wanted_requests'))[0];
  assert.equal(pub.id,id(101));
  assert.deepEqual(Object.keys(pub).sort(),['id','propertyType','city','budgetMin','budgetMax','beds','parking','transaction','timeline','createdAt','expiresAt'].sort());
  assert.ok(!JSON.stringify(pub).includes('example.test'));assert.ok(!JSON.stringify(pub).includes('private note'));
  assert.equal((await rpc('list_wanted_requests',[0,'Québec',null])).length,0);
  await role('authenticated',1);
  await fails(()=>rpc('send_wanted_reply',[id(201),id(101),'Owner cannot respond to own request',null]),/not_available/);
  await role('authenticated',2);
  await fails(()=>rpc('send_wanted_reply',[id(201),id(101),'A private reply from seller 2','999999999999']),/listing_not_found/);
  await rpc('send_wanted_reply',[id(201),id(101),'A private reply from seller 2',null]);
  await rpc('send_wanted_reply',[id(201),id(101),'A private reply from seller 2',null]);
  await fails(()=>rpc('send_wanted_reply',[id(202),id(101),'Another reply from seller 2',null]),/already_replied/);
  assert.equal((await rpc('list_wanted_replies',[null])).length,1);
  await role('authenticated',3);assert.equal((await rpc('list_wanted_replies',[id(101)])).length,0,'other users cannot read private replies');
  await rpc('send_wanted_reply',[id(203),id(101),'Another private reply, seller 3',null]);
  assert.equal((await rpc('list_wanted_replies',[id(101)])).length,1,'sender sees only their own response');
  await role('authenticated',1);assert.equal((await rpc('list_wanted_replies',[id(101)])).length,2,'buyer reads both responses');
  assert.equal((await rpc('get_my_wanted_requests'))[0].replyCount,2);
  await role('authenticated',4,'aal2');assert.equal((await rpc('list_wanted_replies',[id(101)])).length,2,'verified staff can moderate responses');
  await role('authenticated',1);await rpc('withdraw_wanted_request',[id(101)]);await rpc('withdraw_wanted_request',[id(101)]);
  await role('anon');assert.equal((await rpc('list_wanted_requests')).length,0);
  await role('authenticated',6);await fails(()=>rpc('send_wanted_reply',[id(204),id(101),'Reply to a withdrawn request',null]),/not_available/);
  await role('authenticated',1);await create(102);await create(103);await fails(()=>create(104),/rate_limit/);
  await role('authenticated',4,'aal2');await rpc('review_wanted_request',[id(102),0,'rejected','Please check your criteria']);
  await role('anon');assert.equal((await rpc('list_wanted_requests')).length,0,'rejected is not public');
  await role('authenticated',1);assert.equal((await rpc('get_my_wanted_requests')).find(c=>c.id===id(102)).reviewNote,'Please check your criteria');
  await db.exec('reset role');await db.query("update private.wanted_requests set expires_at=now()-interval '1 day' where id=$1",[id(103)]);
  await role('authenticated',4,'aal2');await fails(()=>rpc('review_wanted_request',[id(103),0,'published','']),/not_pending/);
  // Exercise response rate limit using distinct requests, rather than the one-response constraint.
  await db.exec('reset role');
  for(let n=110;n<121;n++)await db.query("insert into private.wanted_requests(id,owner_id,card,status) values($1,$2,$3,'published')",[id(n),id(1),JSON.stringify(card)]);
  await role('authenticated',7);
  for(let n=110;n<120;n++)await rpc('send_wanted_reply',[id(n+200),id(n),'A complete private response for rate testing',null]);
  await fails(()=>rpc('send_wanted_reply',[id(320),id(120),'Eleventh private response for rate testing',null]),/rate_limit/);
  await db.exec('reset role');
  // Bound both sides of the private inbox even for a long-running account or a
  // popular request. Direct inserts here are disposable superuser fixtures.
  for(let n=30;n<131;n++){
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id(n),`reply${n}@example.test`]);
    await db.query('insert into private.wanted_replies(id,request_id,sender_id,message) values($1,$2,$3,$4)',[id(n+1000),id(110),id(n),'Private fixture response for inbox bounds']);
    await db.query("insert into private.wanted_requests(id,owner_id,card,status) values($1,$2,$3,'published')",[id(n+2000),id(1),JSON.stringify(card)]);
    await db.query('insert into private.wanted_replies(id,request_id,sender_id,message) values($1,$2,$3,$4)',[id(n+3000),id(n+2000),id(8),'Private sent fixture for inbox bounds']);
  }
  await role('authenticated',1);assert.equal((await rpc('list_wanted_replies',[id(110)])).length,100,'buyer inbox is bounded');
  assert.equal((await rpc('get_my_wanted_requests')).length,100,'request history is bounded');
  await role('authenticated',8);assert.equal((await rpc('list_wanted_replies',[null])).length,100,'sent responses are bounded');
  await db.exec('reset role');
  const security=await db.query("select proname from pg_proc where pronamespace='public'::regnamespace and proname in ('list_wanted_requests','get_my_wanted_requests','create_wanted_request','withdraw_wanted_request','send_wanted_reply','list_wanted_replies','list_wanted_review','review_wanted_request') and prosecdef");
  assert.equal(security.rows.length,0,'public APIs are security invoker');
  assert.equal((await db.query("select count(*)::int n from pg_class where relnamespace='private'::regnamespace and relname in ('wanted_requests','wanted_replies') and relrowsecurity")).rows[0].n,2);
  console.log('PASS wanted board: verified auth, consent, allowlist, anonymous projection, owner isolation, staff step-up, revision, idempotency, private replies, withdrawal, expiration and per-user limits');
}finally{await db.close();}
