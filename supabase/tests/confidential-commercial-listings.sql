begin;
insert into auth.users(id,email,email_confirmed_at) values
  ('00000000-0000-4000-8000-000000000070','commercial-staff@example.test',now()),
  ('00000000-0000-4000-8000-000000000071','commercial-visitor@example.test',now());
insert into public.staff_members(user_id,role) values('00000000-0000-4000-8000-000000000070','owner');

set local role service_role;
select public.reserve_confidential_listing(
  '00000000-0000-4000-8000-000000000072', repeat('a',64),
  '{"confidential":true,"type":"daycare","title":"Confidential daycare","city":"Québec","postal":"G1K 3A1","price":500000,
    "daycareSubsidy":"subsidized","commercial":{"scope":"both","capacity":60,"reviewAddress":"18 Private Street"},
    "coordinates":{"latitude":46,"longitude":-71},"features":[{"key":"address","value":"18 Private Street"}]}',
  '{"email":"private@example.test","reviewAddress":"18 Private Street"}',
  array['00000000-0000-4000-8000-000000000072/0.png'], repeat('b',64)
);
reset role;
insert into storage.objects(bucket_id,name) values('listing-photos','00000000-0000-4000-8000-000000000072/0.png');
update public.listing_submissions set status='pending' where id='00000000-0000-4000-8000-000000000072';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000070","aal":"aal1"}',true);
do $$ begin
  if not exists(select 1 from public.listing_submissions where contact->>'reviewAddress'='18 Private Street') then
    raise exception 'staff cannot see private address';
  end if;
  if not public.can_read_listing_photo('00000000-0000-4000-8000-000000000072/0.png') then
    raise exception 'staff cannot review photo';
  end if;
end $$;
select public.review_listing('00000000-0000-4000-8000-000000000072',0,'published','approved');
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin
  if public.can_read_listing_photo('00000000-0000-4000-8000-000000000072/0.png')
     or has_function_privilege('anon','public.reserve_confidential_listing(uuid,text,jsonb,jsonb,text[],text)','execute') then
    raise exception 'confidential photo or reservation available to public after approval';
  end if;
end $$;
reset role;

update public.listing_submissions set expires_at=now()-interval '1 hour' where id='00000000-0000-4000-8000-000000000072';
select private.expire_free_listings();
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000070","aal":"aal1"}',true);
select public.renew_free_listing('00000000-0000-4000-8000-000000000072',2,30,'renewed');
reset role;

-- A subsequent publication update must still project the safe fields.
update public.published_listings
set photo_paths=array['00000000-0000-4000-8000-000000000072/0.png'],
    video_path='00000000-0000-4000-8000-000000000072/video.mp4'
where id='00000000-0000-4000-8000-000000000072';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000071","aal":"aal1"}',true);
do $$ begin
  if exists(select 1 from public.listing_submissions) or public.can_read_listing_photo('00000000-0000-4000-8000-000000000072/0.png') then
    raise exception 'non-staff can read private submission data';
  end if;
end $$;
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin
  if not exists(select 1 from public.published_listings
    where property @> '{"commercial":{"scope":"both","capacity":60},"confidential":true,"daycareSubsidy":"subsidized"}'
      and not (property ?| array['postal','coordinates','features','reviewAddress'])
      and not (property->'commercial' ? 'reviewAddress')
      and cardinality(photo_paths)=0 and video_path is null
  ) then raise exception 'published summary is missing or leaks private fields'; end if;
  if public.can_read_listing_photo('00000000-0000-4000-8000-000000000072/0.png')
     or public.can_read_listing_video('00000000-0000-4000-8000-000000000072/video.mp4') then
    raise exception 'published confidential media is readable';
  end if;
end $$;
rollback;
