begin;

-- Free first month for listings submitted through the public form.
-- Only rows created by public.reserve_listing after this migration are marked
-- free_listing; Centris imports and existing listings never expire.
alter table public.listing_submissions
  add column free_listing boolean not null default false,
  add column expires_at timestamptz,
  add column reminder_sent_at timestamptz,
  add column expiry_notice_sent_at timestamptz;
alter table public.listing_submissions drop constraint listing_submissions_status_check;
alter table public.listing_submissions add constraint listing_submissions_status_check
  check(status in ('uploading','pending','published','rejected','expired'));
create index listing_submissions_free_expiry_idx on public.listing_submissions(expires_at)
  where free_listing and status in ('published','expired');

create function private.free_listing_days() returns integer language sql immutable as $$ select 30 $$;

-- Explicit allowlist: never publish private contact, fingerprint or review notes.
create function private.listing_public_details(p_property jsonb) returns jsonb
language sql immutable set search_path='' as $$
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) from jsonb_each(p_property)
  where key=any(array['title','city','district','postal','price','type','beds','baths','area','description','mode','parking','parkingSpaces','streetParking','outdoor','source','lotArea','features','taxExtra','rentPrice','coordinates','transaction','descriptionTranslations']);
$$;

create or replace function public.reserve_listing(p_id uuid,p_fingerprint text,p_property jsonb,p_contact jsonb,p_paths text[],p_client_hash text)
returns text language plpgsql security definer set search_path='' as $$
declare existing public.listing_submissions; n integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(723093);
  select * into existing from public.listing_submissions where id=p_id;
  if found then
    if existing.fingerprint<>p_fingerprint then raise exception 'conflict'; end if;
    return existing.status;
  end if;
  if p_fingerprint !~ '^[a-f0-9]{64}$' or p_client_hash !~ '^[a-f0-9]{64}$' or cardinality(p_paths) not between 1 and 4 then raise exception 'invalid'; end if;
  if exists(select 1 from unnest(p_paths) path where path !~ ('^'||p_id::text||'/[0-3]\.(jpg|png|webp)$')) then raise exception 'invalid_path'; end if;
  delete from public.enquiry_rate_limits where window_start < now()-interval '2 days';
  insert into public.enquiry_rate_limits values('listing:'||p_client_hash,now(),1)
  on conflict(bucket) do update set count=case when enquiry_rate_limits.window_start<now()-interval '1 day' then 1 else enquiry_rate_limits.count+1 end,
    window_start=case when enquiry_rate_limits.window_start<now()-interval '1 day' then now() else enquiry_rate_limits.window_start end returning count into n;
  if n>5 then raise exception 'rate_limit'; end if;
  insert into public.enquiry_rate_limits values('listing:global',now(),1)
  on conflict(bucket) do update set count=case when enquiry_rate_limits.window_start<now()-interval '1 day' then 1 else enquiry_rate_limits.count+1 end,
    window_start=case when enquiry_rate_limits.window_start<now()-interval '1 day' then now() else enquiry_rate_limits.window_start end returning count into n;
  if n>100 then raise exception 'rate_limit'; end if;
  insert into public.listing_submissions(id,fingerprint,property,contact,photo_paths,free_listing)
    values(p_id,p_fingerprint,p_property,p_contact,p_paths,true);
  return 'uploading';
end $$;
revoke all on function public.reserve_listing(uuid,text,jsonb,jsonb,text[],text) from public,anon,authenticated;
grant execute on function public.reserve_listing(uuid,text,jsonb,jsonb,text[],text) to service_role;

-- Same review rules as before; a free listing's 30 days start at its first approval.
-- An expired free listing is brought back only through renew_free_listing.
create or replace function private.review_listing(p_id uuid,p_revision integer,p_decision text,p_note text default '')
returns void language plpgsql security definer set search_path='' as $$
declare s public.listing_submissions; note text:=btrim(coalesce(p_note,'')); event text; next_expiry timestamptz;
begin
  if auth.uid() is null or not private.is_staff() then raise exception 'staff_mfa_required' using errcode='42501'; end if;
  select * into s from public.listing_submissions where id=p_id for update;
  if not found or p_revision is null or s.revision<>p_revision or s.status='uploading' then raise exception 'conflict' using errcode='40001'; end if;
  if p_decision is null or p_decision not in ('published','rejected') or length(note)>2000 then raise exception 'invalid' using errcode='22023'; end if;
  if s.status=p_decision then raise exception 'conflict' using errcode='40001'; end if;
  if p_decision='rejected' and note='' then raise exception 'reason_required' using errcode='22023'; end if;
  next_expiry:=s.expires_at;
  if p_decision='published' then
    if s.status='expired' then raise exception 'renew_required' using errcode='22023'; end if;
    if exists(select 1 from unnest(s.photo_paths) path where (
      (s.property#>>'{source,provider}'='centris' and path ~ '^/centris/[0-9]{7,8}/[0-9]{3}\.webp$')
      or exists(select 1 from storage.objects where bucket_id='listing-photos' and name=path)
    ) is not true) then raise exception 'photos_missing'; end if;
    if s.free_listing then
      if s.expires_at is null then next_expiry:=now()+make_interval(days=>private.free_listing_days());
      elsif s.expires_at<=now() then raise exception 'renew_required' using errcode='22023'; end if;
    end if;
    insert into public.published_listings(id,property,photo_paths) values(p_id,private.listing_public_details(s.property),s.photo_paths);
    event:=case when s.status='rejected' then 'listing_restored' else 'listing_published' end;
  else
    delete from public.published_listings where id=p_id;
    event:=case when s.status='published' then 'listing_withdrawn' else 'listing_rejected' end;
  end if;
  update public.listing_submissions set status=p_decision,revision=revision+1,review_note=note,expires_at=next_expiry where id=p_id;
  insert into public.audit_events(actor_id,action,metadata) values(auth.uid(),event,jsonb_build_object(
    'listing_id',p_id,'listing_number',s.listing_number,'title',s.property->>'title',
    'from_status',s.status,'to_status',p_decision,'note',note,'revision',s.revision+1,'expires_at',next_expiry));
end $$;

-- Staff extend a free listing (for example after an agreed renewal). Nothing is charged here.
create function private.renew_free_listing(p_id uuid,p_revision integer,p_days integer,p_note text default '')
returns timestamptz language plpgsql security definer set search_path='' as $$
declare s public.listing_submissions; note text:=btrim(coalesce(p_note,'')); next_expiry timestamptz;
begin
  if auth.uid() is null or not private.is_staff() then raise exception 'staff_mfa_required' using errcode='42501'; end if;
  if p_days is null or p_days not between 1 and 365 or length(note)>2000 then raise exception 'invalid' using errcode='22023'; end if;
  select * into s from public.listing_submissions where id=p_id for update;
  if not found or p_revision is null or s.revision<>p_revision then raise exception 'conflict' using errcode='40001'; end if;
  if not s.free_listing or s.status not in ('published','expired') then raise exception 'not_renewable' using errcode='22023'; end if;
  next_expiry:=greatest(coalesce(s.expires_at,now()),now())+make_interval(days=>p_days);
  if s.status='expired' then
    if exists(select 1 from unnest(s.photo_paths) path where not exists(select 1 from storage.objects where bucket_id='listing-photos' and name=path)) then raise exception 'photos_missing'; end if;
    insert into public.published_listings(id,property,photo_paths) values(p_id,private.listing_public_details(s.property),s.photo_paths);
  end if;
  update public.listing_submissions set status='published',revision=revision+1,expires_at=next_expiry,
    reminder_sent_at=null,expiry_notice_sent_at=null,review_note=case when note='' then review_note else note end where id=p_id;
  insert into public.audit_events(actor_id,action,metadata) values(auth.uid(),'listing_renewed',jsonb_build_object(
    'listing_id',p_id,'listing_number',s.listing_number,'title',s.property->>'title',
    'from_status',s.status,'to_status','published','note',note,'revision',s.revision+1,'days',p_days,'expires_at',next_expiry));
  return next_expiry;
end $$;
create function public.renew_free_listing(p_id uuid,p_revision integer,p_days integer,p_note text default '')
returns timestamptz language sql security invoker set search_path='' as $$
  select private.renew_free_listing(p_id,p_revision,p_days,p_note);
$$;

-- Hourly job: unpublish free listings whose period has ended. No payment is taken.
create function private.expire_free_listings() returns integer
language plpgsql security definer set search_path='' as $$
declare s public.listing_submissions; n integer:=0;
begin
  for s in select * from public.listing_submissions where free_listing and status='published' and expires_at<=now()
    order by expires_at for update skip locked loop
    delete from public.published_listings where id=s.id;
    update public.listing_submissions set status='expired',revision=revision+1 where id=s.id;
    insert into public.audit_events(actor_id,action,metadata) values(null,'listing_expired',jsonb_build_object(
      'listing_id',s.id,'listing_number',s.listing_number,'title',s.property->>'title','actor_label','Automatic expiry',
      'from_status','published','to_status','expired','revision',s.revision+1,'expires_at',s.expires_at));
    n:=n+1;
  end loop;
  return n;
end $$;

-- Email queue for the send-listing-notices function (service role only).
-- 'reminder' = 7 days before expiry; 'expired' = once, within 7 days after expiry.
create function public.claim_listing_notices() returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(row_data order by row_data->>'expiresAt'),'[]'::jsonb) from (
    select jsonb_build_object('id',id,'kind','reminder','reference',listing_number,'title',property->>'title',
      'expiresAt',expires_at,'email',contact->>'email','name',contact->>'name') row_data
    from public.listing_submissions
    where free_listing and status='published' and reminder_sent_at is null
      and expires_at>now() and expires_at<=now()+interval '7 days' and contact->>'email' is not null
    union all
    select jsonb_build_object('id',id,'kind','expired','reference',listing_number,'title',property->>'title',
      'expiresAt',expires_at,'email',contact->>'email','name',contact->>'name')
    from public.listing_submissions
    where free_listing and status='expired' and expiry_notice_sent_at is null
      and expires_at>now()-interval '7 days' and contact->>'email' is not null
    limit 20
  ) q;
$$;
create function public.complete_listing_notice(p_id uuid,p_kind text,p_expires_at timestamptz) returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_kind='reminder' then
    update public.listing_submissions set reminder_sent_at=now() where id=p_id and expires_at=p_expires_at;
  elsif p_kind='expired' then
    update public.listing_submissions set expiry_notice_sent_at=now() where id=p_id and expires_at=p_expires_at;
  else raise exception 'invalid' using errcode='22023'; end if;
end $$;

create or replace function private.list_listing_history(p_id uuid,p_offset integer default 0)
returns table(id uuid,created_at timestamptz,action text,actor text,metadata jsonb)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.is_staff() then raise exception 'staff_mfa_required' using errcode='42501'; end if;
  if p_offset is null or p_offset<0 then raise exception 'invalid_offset' using errcode='22023'; end if;
  return query select a.id,a.created_at,a.action,coalesce(u.email,a.metadata->>'actor_label',a.actor_id::text),a.metadata
    from public.audit_events a left join auth.users u on u.id=a.actor_id
    where a.metadata->>'listing_id'=p_id::text and a.action in ('listing_published','listing_withdrawn','listing_rejected','listing_restored','listing_renewed','listing_expired')
    order by a.created_at desc,a.id desc limit 21 offset p_offset;
end $$;
drop index public.audit_events_listing_history_idx;
create index audit_events_listing_history_idx on public.audit_events((metadata->>'listing_id'),created_at desc,id desc)
  where action in ('listing_published','listing_withdrawn','listing_rejected','listing_restored','listing_renewed','listing_expired');

revoke all on function private.free_listing_days(),private.listing_public_details(jsonb),private.renew_free_listing(uuid,integer,integer,text),
  public.renew_free_listing(uuid,integer,integer,text),private.expire_free_listings(),public.claim_listing_notices(),
  public.complete_listing_notice(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function private.free_listing_days(),private.listing_public_details(jsonb) to authenticated,service_role;
grant execute on function private.renew_free_listing(uuid,integer,integer,text),public.renew_free_listing(uuid,integer,integer,text) to authenticated;
grant execute on function private.expire_free_listings(),public.claim_listing_notices(),public.complete_listing_notice(uuid,text,timestamptz) to service_role;
commit;
