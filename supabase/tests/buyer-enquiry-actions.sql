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
('11000000-0000-4000-8000-000000000011','reviewer@example.test',now()),
('11000000-0000-4000-8000-000000000012','visitor@example.test',now());
insert into public.staff_members(user_id,role,active) values('11000000-0000-4000-8000-000000000011','owner',true);
insert into private.staff_password_access_users(user_id) values('11000000-0000-4000-8000-000000000011');
insert into public.enquiries(id,payload) values
('21000000-0000-4000-8000-000000000011','{"kind":"buyer","name":"Test Buyer","email":"buyer@example.test"}'),
('21000000-0000-4000-8000-000000000012','{"kind":"seller","name":"Test Seller","email":"seller@example.test"}');
set local role anon;
select test_support.expect_error('select public.review_buyer_enquiry(''21000000-0000-4000-8000-000000000011'',0,''accept'')','42501');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11000000-0000-4000-8000-000000000012","role":"authenticated"}',true);
select test_support.expect_error('select public.list_buyer_enquiries_managed()','42501');
select test_support.expect_error('select public.review_buyer_enquiry(''21000000-0000-4000-8000-000000000011'',0,''delete'')','42501');
select set_config('request.jwt.claims','{"sub":"11000000-0000-4000-8000-000000000011","role":"authenticated"}',true);
select test_support.assert((select count(*)=1 from public.list_buyer_enquiries_managed('pending',0)),'Pending buyer only');
select public.review_buyer_enquiry('21000000-0000-4000-8000-000000000011',0,'accept');
select test_support.assert((select count(*)=1 from public.list_buyer_enquiries_managed('accepted',0)),'Accepted filter');
select test_support.expect_error('select public.review_buyer_enquiry(''21000000-0000-4000-8000-000000000011'',0,''delete'')','40001');
select test_support.expect_error('select public.review_buyer_enquiry(''21000000-0000-4000-8000-000000000012'',0,''accept'')','P0002');
select public.review_buyer_enquiry('21000000-0000-4000-8000-000000000011',1,'delete');
select test_support.assert((select count(*)=0 from public.list_buyer_enquiries_managed('active',0)),'Removed from active inbox');
select test_support.assert((select count(*)=0 from public.list_buyer_enquiries(0)),'Legacy inbox hides deleted');
select test_support.assert((select count(*)=1 from public.list_buyer_enquiries_managed('deleted',0)),'Recoverable in deleted inbox');
select test_support.expect_error('select public.review_buyer_enquiry(''21000000-0000-4000-8000-000000000011'',2,''accept'')','22023');
reset role;
insert into public.enquiries(id,payload) select gen_random_uuid(),'{"kind":"seller","name":"Batch Test","email":"batch@example.test"}'::jsonb from generate_series(1,8);
select test_support.assert(public.claim_enquiry_batch() is null,'Deleted unbatched record excluded from next batch');
set local role authenticated;
select public.review_buyer_enquiry('21000000-0000-4000-8000-000000000011',2,'restore');
select test_support.assert((select count(*)=1 from public.list_buyer_enquiries_managed('accepted',0)),'Restore preserves accepted state');
select public.review_buyer_enquiry('21000000-0000-4000-8000-000000000011',3,'reopen');
select test_support.assert((select revision=4 and payload->>'email'='buyer@example.test' from public.list_buyer_enquiries_managed('pending',0)),'Reopen preserves payload and advances revision');
reset role;
select test_support.assert(jsonb_array_length(public.claim_enquiry_batch()->'rows')=10,'Restored record eligible for batching');
select test_support.assert((select count(*)=4 from public.audit_events where action like 'buyer_enquiry_%'),'Audit actions');
rollback;
