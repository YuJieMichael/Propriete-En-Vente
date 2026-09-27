begin;
insert into auth.users(id,email,email_confirmed_at) values('00000000-0000-4000-8000-000000000010','staff@example.test',now());
insert into public.staff_members(user_id,role) values('00000000-0000-4000-8000-000000000010','owner');
select public.reserve_listing('00000000-0000-4000-8000-000000000020',repeat('a',64),'{"title":"Home","city":"Québec","email":"must-not-leak","parking":true,"parkingSpaces":2,"streetParking":true}', '{"email":"private@example.test"}',array['00000000-0000-4000-8000-000000000020/0.png'],repeat('b',64));
insert into storage.objects(bucket_id,name) values('listing-photos','00000000-0000-4000-8000-000000000020/0.png');
update public.listing_submissions set status='pending';
set local role anon;
do $$ begin
  if (select count(*) from public.published_listings)<>0 or public.can_read_listing_photo('00000000-0000-4000-8000-000000000020/0.png') then raise exception 'pending is public'; end if;
  if has_table_privilege('anon','public.listing_submissions','select') or has_table_privilege('anon','public.published_listings','insert') then raise exception 'public write/private read'; end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000010","aal":"aal1"}',true);
do $$ begin
  begin perform public.review_listing('00000000-0000-4000-8000-000000000020',0,'published','');raise exception 'aal1 permitted';exception when insufficient_privilege then null;end;
  if (select count(*) from public.listing_submissions)<>0 then raise exception 'aal1 can read'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000010","aal":"aal2"}',true);
select public.review_listing('00000000-0000-4000-8000-000000000020',0,'published','private note');
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin
  if (select count(*) from public.published_listings)<>1 then raise exception 'approved missing'; end if;
  if exists(select 1 from public.published_listings where property ? 'email') then raise exception 'private field leaked'; end if;
  if not exists(select 1 from public.published_listings where property->>'parkingSpaces'='2' and property->>'streetParking'='true') then raise exception 'parking details missing'; end if;
  if not public.can_read_listing_photo('00000000-0000-4000-8000-000000000020/0.png') then raise exception 'approved photo hidden'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000010","aal":"aal2"}',true);
select public.review_listing('00000000-0000-4000-8000-000000000020',1,'rejected','withdrawn');
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin
  if (select count(*) from public.published_listings)<>0 or public.can_read_listing_photo('00000000-0000-4000-8000-000000000020/0.png') then raise exception 'withdraw failed'; end if;
end $$;
rollback;
