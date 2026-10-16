-- Applied through the connected migration tool as 20261016153217.
-- Existing rows and leases are retained; each new claim contains one enquiry.
create or replace function public.claim_enquiry_batch()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.enquiry_batches; ids uuid[]; rows jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(723092);
  update public.enquiry_batches set needs_review=true where sent_at is null
    and first_attempt_at < now()-interval '23 hours';
  select * into b from public.enquiry_batches where sent_at is null and not needs_review
    and (lease_until is null or lease_until < now()) order by created_at,id limit 1 for update;
  if not found then
    select array_agg(id) into ids from (
      select id from public.enquiries where batch_id is null and deleted_at is null
      order by created_at,id limit 1
    ) q;
    if coalesce(array_length(ids,1),0)<1 then return null; end if;
    insert into public.enquiry_batches default values returning * into b;
    update public.enquiries set batch_id=b.id where id=any(ids);
  end if;
  update public.enquiry_batches set lease_until=now()+interval '5 minutes',
    first_attempt_at=coalesce(first_attempt_at,now()) where id=b.id;
  select jsonb_agg(payload || jsonb_build_object('created_at',created_at) order by created_at,id)
    into rows from public.enquiries where batch_id=b.id;
  return jsonb_build_object('id',b.id,'rows',rows);
end $$;
-- CREATE OR REPLACE preserves the existing service-role-only execution grants.
