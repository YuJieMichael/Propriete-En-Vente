begin;
do $$
declare i integer; k uuid; second_id uuid; third_id uuid; deleted_id uuid; stale_id uuid;
  b jsonb; b2 jsonb; b3 jsonb; n integer; payload jsonb;
begin
  if has_table_privilege('anon','public.enquiries','select') or has_table_privilege('authenticated','public.enquiries','select')
    or has_function_privilege('anon','public.collect_enquiry(uuid,jsonb,text)','execute')
    or has_function_privilege('authenticated','public.claim_enquiry_batch()','execute') then raise exception 'inbox exposed'; end if;
  if public.claim_enquiry_batch() is not null then raise exception 'empty inbox claimed'; end if;
  k=gen_random_uuid(); payload=jsonb_build_object('kind','buyer','name','First','email','test@example.com');
  perform public.collect_enquiry(k,payload,repeat('a',64));
  perform public.collect_enquiry(k,payload,repeat('a',64));
  select count(*) into n from public.enquiries;
  if n<>1 then raise exception 'retry duplicated entry'; end if;
  b=public.claim_enquiry_batch();
  if b is null or jsonb_array_length(b->'rows')<>1 or b->'rows'->0->>'name'<>'First' then raise exception 'single enquiry did not become eligible immediately'; end if;
  if public.claim_enquiry_batch() is not null then raise exception 'active batch claimed twice'; end if;
  update public.enquiry_batches set lease_until=now()-interval '1 minute' where id=(b->>'id')::uuid;
  b2=public.claim_enquiry_batch();
  if b2<>b then raise exception 'retry changed batch or rows'; end if;
  perform public.complete_enquiry_batch((b->>'id')::uuid,'provider-test');
  if public.claim_enquiry_batch() is not null then raise exception 'completed enquiry claimed again'; end if;

  -- All eight queued enquiries become independent messages in FIFO order.
  for i in 1..8 loop
    k=gen_random_uuid();
    payload=jsonb_build_object('kind',case when i%2=0 then 'buyer' else 'seller' end,'name','Queued '||i,'email','test@example.com');
    perform public.collect_enquiry(k,payload,lpad(i::text,64,'0'));
    update public.enquiries set created_at=now()-interval '1 hour'+i*interval '1 minute' where id=k;
  end loop;
  deleted_id=gen_random_uuid();
  insert into public.enquiries(id,payload,created_at,deleted_at)
    values(deleted_id,payload,now()-interval '2 hours',now());
  for i in 1..8 loop
    b2=public.claim_enquiry_batch();
    if b2 is null or jsonb_array_length(b2->'rows')<>1 or b2->'rows'->0->>'name'<>'Queued '||i then raise exception 'queue lost FIFO order or combined enquiries'; end if;
    if b2->>'id'=b->>'id' then raise exception 'completed batch reused'; end if;
    perform public.complete_enquiry_batch((b2->>'id')::uuid,'provider-queued-'||i);
  end loop;
  if public.claim_enquiry_batch() is not null then raise exception 'soft-deleted enquiry was claimed'; end if;
  if exists(select 1 from public.enquiries where id=deleted_id and batch_id is not null) then raise exception 'deleted enquiry assigned'; end if;

  -- Two overlapping workers cannot receive the same active lease.
  second_id=gen_random_uuid(); third_id=gen_random_uuid();
  insert into public.enquiries(id,payload,created_at) values
    (second_id,payload||'{"name":"Second"}'::jsonb,now()-interval '2 minutes'),
    (third_id,payload||'{"name":"Third"}'::jsonb,now()-interval '1 minute');
  b2=public.claim_enquiry_batch(); b3=public.claim_enquiry_batch();
  if b2->>'id'=b3->>'id' or b2->'rows'->0->>'name'<>'Second' or b3->'rows'->0->>'name'<>'Third' then raise exception 'active leases overlap'; end if;
  if public.claim_enquiry_batch() is not null then raise exception 'active lease duplicated'; end if;
  perform public.complete_enquiry_batch((b2->>'id')::uuid,'provider-second');
  perform public.complete_enquiry_batch((b3->>'id')::uuid,'provider-third');

  insert into public.enquiry_batches(first_attempt_at,lease_until)
    values(now()-interval '24 hours',now()-interval '1 hour') returning id into stale_id;
  insert into public.enquiries(id,payload,batch_id) values(gen_random_uuid(),payload,stale_id);
  if public.claim_enquiry_batch() is not null then raise exception 'uncertain old message automatically retried'; end if;
  if not exists(select 1 from public.enquiry_batches where id=stale_id and needs_review) then raise exception 'uncertain old message not held for review'; end if;
  for i in 1..5 loop perform public.collect_enquiry(gen_random_uuid(),payload,repeat('c',64)); end loop;
  begin
    perform public.collect_enquiry(gen_random_uuid(),payload,repeat('c',64));
    raise exception 'rate limit bypassed';
  exception when raise_exception then
    if sqlerrm <> 'rate_limit' then raise; end if;
  end;
end $$;
rollback;
