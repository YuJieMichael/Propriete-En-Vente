-- Reversible staff triage, separate from the enquiry payload and email delivery.
alter table public.enquiries add column review_status text not null default 'pending' check(review_status in ('pending','accepted')),
 add column deleted_at timestamptz, add column revision integer not null default 0;

create function public.list_buyer_enquiries_managed(p_filter text default 'active',p_offset integer default 0)
returns table(id uuid,created_at timestamptz,payload jsonb,review_status text,deleted_at timestamptz,revision integer)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_staff() then raise exception 'verified_staff_required' using errcode='42501'; end if;
 if p_filter is null or p_filter not in ('active','pending','accepted','deleted') or p_offset is null or p_offset<0 then raise exception 'invalid_filter' using errcode='22023'; end if;
 return query select e.id,e.created_at,e.payload,e.review_status,e.deleted_at,e.revision from public.enquiries e
 where e.payload->>'kind'='buyer' and
 (case when p_filter='deleted' then e.deleted_at is not null else e.deleted_at is null and (p_filter='active' or e.review_status=p_filter) end)
 order by e.created_at desc,e.id desc limit 51 offset p_offset;
end $$;

create function public.review_buyer_enquiry(p_id uuid,p_revision integer,p_action text)
returns table(id uuid,review_status text,deleted_at timestamptz,revision integer)
language plpgsql security definer set search_path='' as $$
declare e public.enquiries; previous_status text;
begin
 if not private.is_staff() then raise exception 'verified_staff_required' using errcode='42501'; end if;
 if p_action is null or p_action not in ('accept','reopen','delete','restore') then raise exception 'invalid_action' using errcode='22023'; end if;
 select * into e from public.enquiries q where q.id=p_id and q.payload->>'kind'='buyer' for update;
 if not found then raise exception 'enquiry_not_found' using errcode='P0002'; end if;
 if p_revision is distinct from e.revision then raise exception 'revision_conflict' using errcode='40001'; end if;
 if e.deleted_at is not null and p_action in ('accept','reopen') then raise exception 'restore_first' using errcode='22023'; end if;
 previous_status=e.review_status;
 update public.enquiries q set
 review_status=case p_action when 'accept' then 'accepted' when 'reopen' then 'pending' else q.review_status end,
 deleted_at=case p_action when 'delete' then coalesce(q.deleted_at,now()) when 'restore' then null else q.deleted_at end,
 revision=q.revision+1 where q.id=p_id returning q.* into e;
 insert into public.audit_events(actor_id,action,metadata) values(auth.uid(),'buyer_enquiry_'||p_action,
 jsonb_build_object('enquiry_id',p_id,'previous_status',previous_status,'status',e.review_status,'revision',e.revision));
 return query select e.id,e.review_status,e.deleted_at,e.revision;
end $$;
revoke all on function public.list_buyer_enquiries_managed(text,integer),public.review_buyer_enquiry(uuid,integer,text) from public,anon;
grant execute on function public.list_buyer_enquiries_managed(text,integer),public.review_buyer_enquiry(uuid,integer,text) to authenticated;

-- Keep the previous inbox endpoint compatible for already-open clients.
create or replace function public.list_buyer_enquiries(p_offset integer default 0)
returns table(id uuid,created_at timestamptz,payload jsonb)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_staff() then raise exception 'verified_staff_required' using errcode='42501'; end if;
 if p_offset is null or p_offset<0 then raise exception 'invalid_offset'; end if;
 return query select e.id,e.created_at,e.payload from public.enquiries e where e.payload->>'kind'='buyer' and e.deleted_at is null
 order by e.created_at desc,e.id desc limit 51 offset p_offset;
end $$;

-- Exclude removed, unbatched enquiries from future batches. Already claimed
-- batches stay immutable so retries use the same email idempotency payload.
create or replace function public.claim_enquiry_batch()
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.enquiry_batches; ids uuid[]; rows jsonb;
begin
 perform pg_catalog.pg_advisory_xact_lock(723092);
 update public.enquiry_batches set needs_review=true where sent_at is null and first_attempt_at<now()-interval '23 hours';
 select * into b from public.enquiry_batches where sent_at is null and not needs_review
 and (lease_until is null or lease_until<now()) order by created_at,id limit 1 for update;
 if not found then
  select array_agg(id) into ids from (select id from public.enquiries where batch_id is null and deleted_at is null order by created_at,id limit 10) q;
  if coalesce(array_length(ids,1),0)<10 then return null; end if;
  insert into public.enquiry_batches default values returning * into b;
  update public.enquiries set batch_id=b.id where id=any(ids);
 end if;
 update public.enquiry_batches set lease_until=now()+interval '5 minutes',first_attempt_at=coalesce(first_attempt_at,now()) where id=b.id;
 select jsonb_agg(payload||jsonb_build_object('created_at',created_at) order by created_at,id) into rows from public.enquiries where batch_id=b.id;
 return jsonb_build_object('id',b.id,'rows',rows);
end $$;
revoke all on function public.claim_enquiry_batch() from public,anon,authenticated;
grant execute on function public.claim_enquiry_batch() to service_role;
