begin;
insert into auth.users(id,email,email_confirmed_at) values('00000000-0000-4000-8000-000000000710','staff-free@example.test',now());
insert into public.staff_members(user_id,role) values('00000000-0000-4000-8000-000000000710','owner');
select public.reserve_listing('00000000-0000-4000-8000-000000000720',repeat('c',64),'{"title":"Free home","city":"Brossard"}',
  '{"name":"Owner","email":"owner@example.test"}',array['00000000-0000-4000-8000-000000000720/0.png'],repeat('d',64));
insert into storage.objects(bucket_id,name) values('listing-photos','00000000-0000-4000-8000-000000000720/0.png');
update public.listing_submissions set status='pending' where id='00000000-0000-4000-8000-000000000720';
do $$ begin
  if not (select free_listing from public.listing_submissions where id='00000000-0000-4000-8000-000000000720') then raise exception 'public submission not free'; end if;
  if exists(select 1 from public.listing_submissions where id='00000000-0000-4000-8000-000000000720' and expires_at is not null) then raise exception 'expiry before approval'; end if;
end $$;

-- Approval starts the 30-day period.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000710","aal":"aal1"}',true);
select public.review_listing('00000000-0000-4000-8000-000000000720',0,'published','');
reset role;
do $$ declare e timestamptz; begin
  select expires_at into e from public.listing_submissions where id='00000000-0000-4000-8000-000000000720';
  if e is null or e < now()+interval '29 days 23 hours' or e > now()+interval '30 days 1 hour' then raise exception 'expiry not 30 days: %',e; end if;
  if (select count(*) from public.published_listings where id='00000000-0000-4000-8000-000000000720')<>1 then raise exception 'not published'; end if;
  if jsonb_array_length(public.claim_listing_notices())<>0 then raise exception 'reminder too early'; end if;
end $$;

-- Seven days before expiry the reminder is queued once.
update public.listing_submissions set expires_at=now()+interval '5 days' where id='00000000-0000-4000-8000-000000000720';
do $$ declare q jsonb; begin
  q:=public.claim_listing_notices();
  if jsonb_array_length(q)<>1 or q->0->>'kind'<>'reminder' or q->0->>'email'<>'owner@example.test' then raise exception 'reminder missing: %',q; end if;
  perform public.complete_listing_notice((q->0->>'id')::uuid,'reminder',(q->0->>'expiresAt')::timestamptz);
  if jsonb_array_length(public.claim_listing_notices())<>0 then raise exception 'reminder repeated'; end if;
  if private.expire_free_listings()<>0 then raise exception 'expired early'; end if;
end $$;

-- After the end date the hourly job unpublishes it and queues one notice.
update public.listing_submissions set expires_at=now()-interval '1 minute' where id='00000000-0000-4000-8000-000000000720';
do $$ declare q jsonb; begin
  if private.expire_free_listings()<>1 then raise exception 'not expired'; end if;
  if exists(select 1 from public.published_listings where id='00000000-0000-4000-8000-000000000720') then raise exception 'still public'; end if;
  if (select status from public.listing_submissions where id='00000000-0000-4000-8000-000000000720')<>'expired' then raise exception 'status'; end if;
  if not exists(select 1 from public.audit_events where action='listing_expired' and metadata->>'listing_id'='00000000-0000-4000-8000-000000000720') then raise exception 'no audit'; end if;
  q:=public.claim_listing_notices();
  if jsonb_array_length(q)<>1 or q->0->>'kind'<>'expired' then raise exception 'expiry notice missing: %',q; end if;
  perform public.complete_listing_notice((q->0->>'id')::uuid,'expired',(q->0->>'expiresAt')::timestamptz);
end $$;

-- Review cannot silently republish; staff renew instead.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000710","aal":"aal1"}',true);
do $$ begin
  begin perform public.review_listing('00000000-0000-4000-8000-000000000720',2,'published','');raise exception 'expired republished';
  exception when sqlstate '22023' then null; end;
end $$;
select public.renew_free_listing('00000000-0000-4000-8000-000000000720',2,30,'Renewed by phone');
reset role;
do $$ declare s public.listing_submissions; begin
  select * into s from public.listing_submissions where id='00000000-0000-4000-8000-000000000720';
  if s.status<>'published' or s.expires_at < now()+interval '29 days' or s.reminder_sent_at is not null or s.expiry_notice_sent_at is not null then raise exception 'renew state'; end if;
  if (select count(*) from public.published_listings where id='00000000-0000-4000-8000-000000000720')<>1 then raise exception 'renew not public'; end if;
end $$;

-- Non-staff cannot renew; anon cannot read the notice queue.
insert into auth.users(id,email,email_confirmed_at) values('00000000-0000-4000-8000-000000000711','user-free@example.test',now());
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000711","aal":"aal1"}',true);
do $$ begin
  begin perform public.renew_free_listing('00000000-0000-4000-8000-000000000720',3,30,'');raise exception 'non-staff renewed';
  exception when insufficient_privilege then null; end;
  if has_function_privilege('authenticated','public.claim_listing_notices()','execute') then raise exception 'queue exposed'; end if;
end $$;
reset role;

-- Listings that were not submitted through the public form never expire.
do $$ begin
  if exists(select 1 from public.listing_submissions where not free_listing and expires_at is not null) then raise exception 'non-free listing has expiry'; end if;
end $$;
rollback;
