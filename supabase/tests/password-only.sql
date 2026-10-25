begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('20000000-0000-4000-8000-000000000001','owner-password@example.test',now()),
 ('20000000-0000-4000-8000-000000000002','operator-password@example.test',now()),
 ('20000000-0000-4000-8000-000000000003','inactive-password@example.test',now()),
 ('20000000-0000-4000-8000-000000000004','unconfirmed-password@example.test',null),
 ('20000000-0000-4000-8000-000000000005','seller-password@example.test',now());
insert into public.staff_members(user_id,role,active) values
 ('20000000-0000-4000-8000-000000000001','owner',true),
 ('20000000-0000-4000-8000-000000000002','operator',true),
 ('20000000-0000-4000-8000-000000000003','owner',false),
 ('20000000-0000-4000-8000-000000000004','operator',true);
set local role authenticated;
do $$ declare n integer; allowed boolean; begin
 for n in 1..5 loop
  perform set_config('request.jwt.claims',jsonb_build_object(
    'sub','20000000-0000-4000-8000-'||lpad(n::text,12,'0'),
    'role','authenticated','aal','aal1','user_metadata',jsonb_build_object('role','owner'))::text,true);
  allowed := public.get_my_staff_access();
  if allowed is distinct from (n in (1,2)) then
    raise exception 'Password-only authorization failed for fixture %',n;
  end if;
 end loop;
 perform set_config('request.jwt.claims','{}',true);
 if public.get_my_staff_access() then raise exception 'missing identity authorized'; end if;
end $$;
rollback;
