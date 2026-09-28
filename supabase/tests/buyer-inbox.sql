begin;
insert into auth.users(id,email,email_confirmed_at) values('00000000-0000-4000-8000-000000000090','staff@example.test',now());
insert into public.staff_members(user_id,role) values('00000000-0000-4000-8000-000000000090','owner');
insert into public.enquiries(id,payload) values
('00000000-0000-4000-8000-000000000091','{"kind":"buyer","name":"Buyer","email":"buyer@example.test"}'),
('00000000-0000-4000-8000-000000000092','{"kind":"seller","name":"Seller","email":"seller@example.test"}');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000090","aal":"aal1"}',true);
do $$ begin
  begin perform public.list_buyer_enquiries(); raise exception 'unverified staff allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000090","aal":"aal2"}',true);
do $$ begin
  if (select count(*) from public.list_buyer_enquiries())<>1 then raise exception 'wrong buyer count'; end if;
  if exists(select 1 from public.list_buyer_enquiries() where payload->>'kind'<>'buyer') then raise exception 'seller leaked into buyer list'; end if;
  if (select count(*) from public.list_buyer_enquiries(1))<>0 then raise exception 'paging failed'; end if;
  perform public.set_buyer_enquiry_status('00000000-0000-4000-8000-000000000091','replied');
  if (select status from public.list_buyer_enquiries() where id='00000000-0000-4000-8000-000000000091')<>'replied' then raise exception 'staff could not update enquiry'; end if;
  begin perform public.set_buyer_enquiry_status('00000000-0000-4000-8000-000000000091','invalid'); raise exception 'invalid status allowed'; exception when invalid_parameter_value then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000093","aal":"aal2"}',true);
do $$ begin
  begin perform public.list_buyer_enquiries(); raise exception 'customer allowed'; exception when insufficient_privilege then null; end;
  begin perform public.set_buyer_enquiry_status('00000000-0000-4000-8000-000000000091','read'); raise exception 'customer status update allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if has_function_privilege('anon','public.list_buyer_enquiries(integer)','execute') then raise exception 'anonymous allowed'; end if;
  if has_function_privilege('anon','public.set_buyer_enquiry_status(uuid,text)','execute') then raise exception 'anonymous status update allowed'; end if;
  if (select count(*) from public.enquiries where batch_id is null)<>2 then raise exception 'inbox changed batch state'; end if;
end $$;
rollback;
