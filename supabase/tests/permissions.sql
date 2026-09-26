-- Integration assertions. Run bootstrap.sql + migrations first in a disposable
-- database owned by a superuser; each failure raises rather than printing PASS.
-- This transaction rolls back all fixtures and test helpers.
begin;
create schema test_support;
create function test_support.assert(p_result boolean, p_message text) returns void
language plpgsql as $$ begin
  if p_result is distinct from true then raise exception 'ASSERTION FAILED: %', p_message; end if;
end $$;
create function test_support.expect_error(p_sql text, p_state text) returns void
language plpgsql as $$ begin
  begin execute p_sql;
  exception when others then
    if sqlstate = p_state then return; end if;
    raise exception 'Expected SQLSTATE %, got %: %', p_state, sqlstate, sqlerrm;
  end;
  raise exception 'Expected SQLSTATE %, query unexpectedly succeeded: %', p_state, p_sql;
end $$;
grant usage on schema test_support to anon, authenticated, service_role;
grant execute on all functions in schema test_support to anon, authenticated, service_role;

insert into auth.users(id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000000001', 'seller-a@example.test', now()),
  ('00000000-0000-4000-8000-000000000002', 'seller-b@example.test', now()),
  ('00000000-0000-4000-8000-000000000003', 'owner@example.test', now()),
  ('00000000-0000-4000-8000-000000000004', 'operator@example.test', now()),
  ('00000000-0000-4000-8000-000000000005', 'invited@example.test', now()),
  ('00000000-0000-4000-8000-000000000006', 'unverified@example.test', null);
insert into public.staff_members(user_id, role) values
  ('00000000-0000-4000-8000-000000000003', 'owner'),
  ('00000000-0000-4000-8000-000000000004', 'operator');

-- An anonymous request cannot create/read private projects or query staff roles.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select test_support.expect_error('select public.ensure_project()', '42501');
select test_support.expect_error('select * from public.projects', '42501');
select test_support.expect_error('select public.get_my_staff_role()', '42501');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}', true);
select test_support.expect_error('select public.ensure_project()', '42501');

-- Seller A gets exactly one project even after repeat creation.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
select public.ensure_project();
select public.ensure_project();
select test_support.assert((select count(*) = 1 from public.projects), 'ensure_project is idempotent');
select set_config('test.project_a', (select id::text from public.projects), true);
select test_support.expect_error('update public.projects set status = ''approved''', '42501');
select test_support.expect_error('insert into public.staff_members(user_id,role) values (auth.uid(),''owner'')', '42501');
select test_support.expect_error('insert into public.audit_events(action) values (''fake'')', '42501');
select test_support.expect_error('select public.finish_staff_invite(auth.uid(), auth.uid())', '42501');
select test_support.expect_error('select public.review_project(current_setting(''test.project_a'')::uuid,0,''approved'','''')', '42501');
select test_support.expect_error('select public.submit_project(current_setting(''test.project_a'')::uuid,0)', '22023');

select public.save_project(current_setting('test.project_a')::uuid, 0, 'without',
  '{"address":"123 rue Exemple","city":"Montréal","postal":"H2X 1Y4","type":"0","broker":"0","timeline":"0","language":"fr","name":"Test Seller","email":"seller@example.test","phone":"5145550123","consent":true,"date":""}',
  array['photo'], true, '[]');
select test_support.expect_error('select public.save_project(current_setting(''test.project_a'')::uuid,1,''without'',''{}'',''{}'',false,''[{"name":"Buyer A","date":"2026-10-03","time":"10:30"},{"name":"Buyer B","date":"2026-10-03","time":"10:30"}]'')', '22023');
select test_support.expect_error('select public.save_project(current_setting(''test.project_a'')::uuid,0,''without'',''{}'',''{}'',false,''[]'')', '40001');
select test_support.expect_error('select public.save_project(current_setting(''test.project_a'')::uuid,1,''without'',''{"role":"owner"}'',''{}'',false,''[]'')', '22023');
select test_support.expect_error('select public.save_project(current_setting(''test.project_a'')::uuid,1,''without'',''{"date":"2026-02-31"}'',''{}'',false,''[]'')', '22023');
select test_support.expect_error('select public.save_project(current_setting(''test.project_a'')::uuid,1,''without'',''{}'',array[''photo'',''photo''],false,''[]'')', '22023');
select test_support.expect_error('select public.submit_project(current_setting(''test.project_a'')::uuid,1)', '22023');

-- Metadata requires a real uploaded object and its actual byte/MIME metadata.
select set_config('test.photo_a', '00000000-0000-4000-8000-000000000001/' || current_setting('test.project_a') || '/10000000-0000-4000-8000-000000000001.jpg', true);
select test_support.expect_error('insert into public.project_files(id,project_id,owner_id,kind,name,size,mime_type,storage_path) values (''10000000-0000-4000-8000-000000000001'',current_setting(''test.project_a'')::uuid,auth.uid(),''photo'',''test.jpg'',1024,''image/jpeg'',current_setting(''test.photo_a''))', '22023');
insert into storage.objects(bucket_id, name, owner_id, metadata) values
  ('project-files', current_setting('test.photo_a'), auth.uid()::text, '{"size":1024,"mimetype":"image/jpeg"}');
select test_support.expect_error('insert into public.project_files(id,project_id,owner_id,kind,name,size,mime_type,storage_path) values (''10000000-0000-4000-8000-000000000001'',current_setting(''test.project_a'')::uuid,auth.uid(),''photo'',''test.jpg'',2048,''image/jpeg'',current_setting(''test.photo_a''))', '22023');
insert into public.project_files(id,project_id,owner_id,kind,name,size,mime_type,storage_path) values
  ('10000000-0000-4000-8000-000000000001',current_setting('test.project_a')::uuid,auth.uid(),'photo','test.jpg',1024,'image/jpeg',current_setting('test.photo_a'));
select test_support.assert((select revision = 2 from public.projects), 'photo insertion advances revision');
select test_support.expect_error('delete from public.project_files', '22023');
select public.submit_project(current_setting('test.project_a')::uuid, 2);

-- A second seller cannot read another project, read/download its file, write
-- to its path, use its save RPC, or fabricate an administrator via user_metadata.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","user_metadata":{"role":"owner"}}', true);
select public.ensure_project();
select test_support.assert((select count(*) = 1 from public.projects), 'other project hidden by RLS');
select test_support.assert((select count(*) = 0 from public.project_files), 'other file metadata hidden');
select test_support.assert((select count(*) = 0 from storage.objects), 'other file storage hidden');
select test_support.assert(public.get_my_staff_role() is null, 'metadata cannot manufacture role');
select test_support.expect_error('select public.save_project(current_setting(''test.project_a'')::uuid,3,''without'',''{}'',''{}'',false,''[]'')', '42501');
select test_support.expect_error('select public.submit_project(current_setting(''test.project_a'')::uuid,3)', '42501');
select test_support.expect_error('insert into storage.objects(bucket_id,name) values (''project-files'',current_setting(''test.photo_a'') || ''.png'')', '42501');
select test_support.expect_error('insert into storage.objects(bucket_id,name) values (''project-files'',replace(current_setting(''test.photo_a''),''10000000-0000-4000-8000-000000000001'',''10000000-0000-4000-8000-000000000099''))', '42501');
select test_support.expect_error('select public.review_project(current_setting(''test.project_a'')::uuid,3,''approved'','''')', '42501');
delete from storage.objects where name = current_setting('test.photo_a');
delete from public.project_files where project_id = current_setting('test.project_a')::uuid;

-- Active staff must complete MFA before reading private seller data or reviewing.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}', true);
select test_support.assert(public.get_my_staff_role() = 'operator', 'role discoverable before MFA challenge');
select test_support.assert((select count(*) = 0 from public.projects), 'staff aal1 cannot read sellers');
select test_support.assert((select count(*) = 0 from public.project_files), 'staff aal1 cannot read files');
select test_support.assert((select count(*) = 0 from storage.objects), 'staff aal1 cannot access storage');
select test_support.expect_error('select public.review_project(current_setting(''test.project_a'')::uuid,3,''approved'','''')', '42501');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}', true);
select test_support.assert((select count(*) = 2 from public.projects), 'MFA staff can review sellers');
select test_support.assert((select count(*) = 1 from public.project_files), 'MFA staff can read files');
select test_support.assert((select count(*) = 1 from storage.objects), 'MFA staff can read registered storage');
delete from public.project_files where project_id = current_setting('test.project_a')::uuid;
delete from storage.objects where name = current_setting('test.photo_a');
select test_support.assert((select count(*) = 1 from public.project_files), 'staff cannot delete seller file metadata');
select test_support.assert((select count(*) = 1 from storage.objects), 'staff cannot delete seller storage');
select test_support.expect_error('select public.review_project(current_setting(''test.project_a'')::uuid,3,''changes_requested'','''')', '22023');
select public.review_project(current_setting('test.project_a')::uuid, 3, 'approved', 'Checked');
select test_support.assert((select count(*) = 1 from public.audit_events where action = 'project_reviewed'), 'review produces audit atomically');
select test_support.expect_error('select public.review_project(current_setting(''test.project_a'')::uuid,3,''approved'','''')', '40001');
select test_support.expect_error('insert into storage.objects(bucket_id,name) values (''project-files'',current_setting(''test.photo_a'') || ''.png'')', '42501');

-- Unchanged saves preserve approval. Real edits invalidate it and stale tabs
-- cannot overwrite the edited project. File changes do the same.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
select public.save_project(id, revision, plan, details, services, completed, visits) from public.projects;
select test_support.assert((select status = 'approved' and revision = 4 from public.projects), 'identical autosave keeps approved revision');
select public.save_project(id, revision, 'with', details, services, completed, visits) from public.projects;
select test_support.assert((select status = 'draft' and revision = 5 from public.projects), 'edited project returns to draft');
select public.submit_project(current_setting('test.project_a')::uuid, 5);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}', true);
select public.review_project(current_setting('test.project_a')::uuid, 6, 'approved', 'Checked again');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
delete from storage.objects where name = current_setting('test.photo_a');
select test_support.assert((select status = 'draft' and revision = 8 from public.projects), 'object deletion invalidates approval before metadata deletion');
select test_support.expect_error('select public.submit_project(current_setting(''test.project_a'')::uuid,8)', '22023');
delete from public.project_files where project_id = current_setting('test.project_a')::uuid;
select test_support.assert((select revision = 9 from public.projects), 'metadata deletion advances revision');

-- Enforced quotas are database rules, not just file-input limits. An object can
-- temporarily exist before metadata registration; on rejection the client must
-- delete that unregistered object, as this fixture does.
do $$
declare v_id uuid; v_path text; v_kind text; v_mime text; v_ext text; v_max integer; i integer;
begin
  foreach v_kind in array array['photo', 'document'] loop
    v_mime := case when v_kind = 'photo' then 'image/png' else 'application/pdf' end;
    v_ext := case when v_kind = 'photo' then 'png' else 'pdf' end;
    v_max := case when v_kind = 'photo' then 8 else 10 end;
    for i in 1..v_max + 1 loop
      v_id := gen_random_uuid();
      v_path := auth.uid()::text || '/' || current_setting('test.project_a') || '/' || v_id::text || '.' || v_ext;
      insert into storage.objects(bucket_id,name,metadata) values ('project-files',v_path,jsonb_build_object('size',42,'mimetype',v_mime));
      if i <= v_max then
        insert into public.project_files(id,project_id,owner_id,kind,name,size,mime_type,storage_path)
          values (v_id,current_setting('test.project_a')::uuid,auth.uid(),v_kind,'test.' || v_ext,42,v_mime,v_path);
      else
        perform test_support.expect_error(format(
          'insert into public.project_files(id,project_id,owner_id,kind,name,size,mime_type,storage_path) values (%L,%L,%L,%L,%L,42,%L,%L)',
          v_id,current_setting('test.project_a'),auth.uid(),v_kind,'test.' || v_ext,v_mime,v_path), '22023');
        delete from storage.objects where bucket_id = 'project-files' and name = v_path;
      end if;
    end loop;
  end loop;
end $$;
select test_support.assert((select count(*) = 8 from public.project_files where kind = 'photo'), 'eight-photo limit enforced');
select test_support.assert((select count(*) = 10 from public.project_files where kind = 'document'), 'ten-document limit enforced');
select test_support.expect_error('update public.project_files set name = ''changed.pdf''', '42501');
update storage.objects set metadata = '{"size":999,"mimetype":"image/png"}' where name like '%png';
select test_support.assert((select count(*) = 0 from storage.objects where metadata->>'size' = '999'), 'existing storage cannot be overwritten');

-- Invitations: only service role RPC, actor must still be an active owner,
-- staff creation and audit insertion are one transaction.
reset role;
select set_config('request.jwt.claims', '{}', true);
set local role service_role;
select test_support.expect_error('select public.finish_staff_invite(''00000000-0000-4000-8000-000000000004'',''00000000-0000-4000-8000-000000000005'')', '42501');
select public.finish_staff_invite('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000005');
select test_support.assert((select role = 'operator' and active from public.staff_members where user_id = '00000000-0000-4000-8000-000000000005'), 'invite grants operator');
select test_support.assert((select count(*) = 1 from public.audit_events where action = 'staff_invited'), 'invite audit created');
select test_support.expect_error('select public.finish_staff_invite(''00000000-0000-4000-8000-000000000003'',''00000000-0000-4000-8000-000000000004'')', '23505');
update public.staff_members set active = false where user_id = '00000000-0000-4000-8000-000000000004';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}', true);
select test_support.assert(public.get_my_staff_role() is null, 'inactive staff role revoked immediately');
select test_support.assert((select count(*) = 0 from public.projects), 'inactive staff cannot read projects');
select test_support.assert((select count(*) = 0 from public.audit_events), 'inactive staff cannot read audit');
select test_support.expect_error('select public.review_project(current_setting(''test.project_a'')::uuid,6,''approved'','''')', '42501');

rollback;
