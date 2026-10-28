begin;
-- Additive metadata only. Raw requests remain byte-for-byte equal for retry checks.
alter table public.enquiries add column listing_context jsonb;
-- Previously claimed emails must keep their original attachment on provider retries.
alter table public.enquiry_batches add column csv_version integer not null default 1 check(csv_version in (1,2));
alter table public.enquiry_batches alter column csv_version set default 2;

create function private.enquiry_listing_context(p_payload jsonb,p_source text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare ref text:=trim(coalesce(p_payload->>'listingReference','')); item public.published_listings; address text; lang text;
begin
 if coalesce(p_payload->>'kind','')<>'buyer' or ref='' then return '{}'::jsonb; end if;
 if ref ~ '^[0-9]{1,18}$' then
  select * into item from public.published_listings where listing_number=ref::bigint;
 elsif ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
  select * into item from public.published_listings where id=ref::uuid;
 end if;
 if item.id is null then return jsonb_build_object('listingStatus','unresolved'); end if;
 lang=case when p_payload->>'language' in ('en','fr','zh') then p_payload->>'language' else 'fr' end;
 -- Use only the already-public title. Never read source.originalAddress or contacts.
 address=coalesce(item.property->>'title','');
 if item.property->'source'->>'placeholder'='true' or trim(address)='' or address ~* '(non publi|not (published|disclosed)|unavailable|non disponible|未公开)' then address=''; end if;
 return jsonb_build_object(
  'listingStatus','linked','listingId',item.id::text,'listingNumber',item.listing_number::text,
  'listingTitle',case when address='' then '' else item.property->>'title' end,
  'listingAddress',address,'listingAddressStatus',case when address='' then 'unpublished' else 'published' end,
  'listingCity',coalesce(item.property->>'city',''),
  'listingPrice',case when item.property->>'transaction'='rent' then coalesce(item.property->>'rentPrice','') else coalesce(item.property->>'price','') end,
  'listingTransaction',coalesce(item.property->>'transaction','sale'),
  'listingUrl','https://proprieteenvente.ca/'||lang||'/proprietes/'||coalesce(item.listing_number::text,item.id::text)||'/',
  'listingResolvedAt',now()::text,'listingSnapshotSource',p_source);
end $$;
revoke all on function private.enquiry_listing_context(jsonb,text) from public,anon,authenticated;

create function private.capture_enquiry_listing_context() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 new.listing_context=private.enquiry_listing_context(new.payload,'submission');
 return new;
end $$;
revoke all on function private.capture_enquiry_listing_context() from public,anon,authenticated;
create trigger enquiry_listing_context before insert on public.enquiries
 for each row execute function private.capture_enquiry_listing_context();

-- This records today's verified publication, not a claim about the original price.
update public.enquiries set listing_context=private.enquiry_listing_context(payload,'backfill') where listing_context is null;

create or replace function public.list_buyer_enquiries_managed(p_filter text default 'active',p_offset integer default 0)
returns table(id uuid,created_at timestamptz,payload jsonb,review_status text,deleted_at timestamptz,revision integer)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_staff() then raise exception 'verified_staff_required' using errcode='42501'; end if;
 if p_filter is null or p_filter not in ('active','pending','accepted','deleted') or p_offset is null or p_offset<0 then raise exception 'invalid_filter' using errcode='22023'; end if;
 return query select e.id,e.created_at,e.payload||coalesce(e.listing_context,'{}'::jsonb),e.review_status,e.deleted_at,e.revision from public.enquiries e
 where e.payload->>'kind'='buyer' and
 (case when p_filter='deleted' then e.deleted_at is not null else e.deleted_at is null and (p_filter='active' or e.review_status=p_filter) end)
 order by e.created_at desc,e.id desc limit 51 offset p_offset;
end $$;

create or replace function public.list_buyer_enquiries(p_offset integer default 0)
returns table(id uuid,created_at timestamptz,payload jsonb)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_staff() then raise exception 'verified_staff_required' using errcode='42501'; end if;
 if p_offset is null or p_offset<0 then raise exception 'invalid_offset'; end if;
 return query select e.id,e.created_at,e.payload||coalesce(e.listing_context,'{}'::jsonb) from public.enquiries e
 where e.payload->>'kind'='buyer' and e.deleted_at is null order by e.created_at desc,e.id desc limit 51 offset p_offset;
end $$;

create or replace function public.claim_enquiry_batch()
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.enquiry_batches; ids uuid[]; rows jsonb;
begin
 perform pg_catalog.pg_advisory_xact_lock(723092);
 update public.enquiry_batches set needs_review=true where sent_at is null and first_attempt_at<now()-interval '23 hours';
 select * into b from public.enquiry_batches where sent_at is null and not needs_review
 and (lease_until is null or lease_until<now()) order by created_at,id limit 1 for update;
 if not found then
  select array_agg(id) into ids from (select id from public.enquiries where batch_id is null and deleted_at is null order by created_at,id limit 1) q;
  if coalesce(array_length(ids,1),0)<1 then return null; end if;
  insert into public.enquiry_batches default values returning * into b;
  update public.enquiries set batch_id=b.id where id=any(ids);
 end if;
 update public.enquiry_batches set lease_until=now()+interval '5 minutes',first_attempt_at=coalesce(first_attempt_at,now()) where id=b.id;
 select jsonb_agg(payload || case when b.csv_version=2 then coalesce(listing_context,'{}'::jsonb) else '{}'::jsonb end || jsonb_build_object('created_at',created_at) order by created_at,id)
 into rows from public.enquiries where batch_id=b.id;
 return jsonb_build_object('id',b.id,'rows',rows,'csvVersion',b.csv_version);
end $$;
-- Replacements retain the existing staff-only and service-role-only grants.
commit;
