begin;
create schema test_support;
create function test_support.assert(p_result boolean,p_message text) returns void language plpgsql as $$
begin if p_result is distinct from true then raise exception '%',p_message; end if; end $$;
create function test_support.expect_error(p_sql text,p_state text) returns void language plpgsql as $$
begin begin execute p_sql; exception when others then if sqlstate=p_state then return; end if; raise; end;
raise exception 'Expected SQLSTATE %',p_state; end $$;
grant usage on schema test_support to anon,authenticated;
grant execute on all functions in schema test_support to anon,authenticated;
insert into auth.users(id,email,email_confirmed_at) values
('11000000-0000-4000-8000-000000000001','cancel-a@example.test',now()),
('11000000-0000-4000-8000-000000000002','cancel-b@example.test',now());
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.create_project('21000000-0000-4000-8000-000000000001','100 Test Street','Montréal','without');
select public.set_project_cancelled('21000000-0000-4000-8000-000000000001',0,true);
select test_support.assert((select cancelled_at is not null and revision=1 and details->>'address'='100 Test Street' and status='draft' from public.projects where id='21000000-0000-4000-8000-000000000001'),'Cancellation preserves details');
select test_support.expect_error('select public.set_project_cancelled(''21000000-0000-4000-8000-000000000001'',0,false)','40001');
select set_config('request.jwt.claims','{"sub":"11000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select test_support.expect_error('select public.set_project_cancelled(''21000000-0000-4000-8000-000000000001'',1,false)','42501');
select set_config('request.jwt.claims','{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.set_project_cancelled('21000000-0000-4000-8000-000000000001',1,false);
select test_support.assert((select cancelled_at is null and revision=2 from public.projects where id='21000000-0000-4000-8000-000000000001'),'Restore project');
set local role anon;
select test_support.expect_error('select public.set_project_cancelled(''21000000-0000-4000-8000-000000000001'',2,true)','42501');
rollback;
