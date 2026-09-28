begin;
insert into auth.users(id,email,email_confirmed_at) values('12000000-0000-4000-8000-000000000011','reviewer@example.test',now());
insert into public.staff_members(user_id,role,active) values('12000000-0000-4000-8000-000000000011','owner',true);
insert into private.staff_password_access_users(user_id) values('12000000-0000-4000-8000-000000000011');
select public.reserve_listing('22000000-0000-4000-8000-000000000011',repeat('a',64),'{"title":"Reference test","city":"Montréal"}','{"email":"private@example.test"}',array['22000000-0000-4000-8000-000000000011/0.png'],repeat('b',64));
select public.reserve_listing('22000000-0000-4000-8000-000000000012',repeat('c',64),'{"title":"Second test","city":"Montréal"}','{"email":"private@example.test"}',array['22000000-0000-4000-8000-000000000012/0.png'],repeat('d',64));
insert into storage.objects(bucket_id,name) values('listing-photos','22000000-0000-4000-8000-000000000011/0.png');
update public.listing_submissions set status='pending';
do $$begin
 if (select count(distinct listing_number) from public.listing_submissions)<>2 then raise exception 'duplicate reference'; end if;
 if exists(select 1 from public.listing_submissions where listing_number<100001) then raise exception 'invalid reference'; end if;
end$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"12000000-0000-4000-8000-000000000011","role":"authenticated"}',true);
select public.review_listing('22000000-0000-4000-8000-000000000011',0,'published','');
reset role;
do $$begin
 if not exists(select 1 from public.published_listings p join public.listing_submissions s using(id) where p.listing_number=s.listing_number) then raise exception 'number changed on publication'; end if;
end$$;
set local role authenticated;
select public.review_listing('22000000-0000-4000-8000-000000000011',1,'rejected','');
reset role;
update public.listing_submissions set status='pending' where id='22000000-0000-4000-8000-000000000011';
set local role authenticated;
select public.review_listing('22000000-0000-4000-8000-000000000011',2,'published','');
reset role;
do $$begin
 if not exists(select 1 from public.published_listings p join public.listing_submissions s using(id) where p.listing_number=s.listing_number) then raise exception 'number changed on republish'; end if;
end$$;
set local role anon;
do $$begin
 if (select count(*) from public.published_listings where listing_number::text~'^[0-9]+$')<>1 then raise exception 'public numeric reference missing'; end if;
 if has_table_privilege('anon','public.listing_submissions','select') then raise exception 'private submissions exposed'; end if;
end$$;
rollback;

