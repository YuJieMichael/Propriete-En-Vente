do $$ declare c jsonb; b jsonb; original_payload jsonb; begin
 if exists(select * from public.test_original_enquiries except select id,payload,created_at,batch_id,review_status,deleted_at,revision from public.enquiries) then raise exception 'migration changed historical data'; end if;
 if (select count(*) from public.enquiries)<>(select count(*) from public.test_original_enquiries) then raise exception 'migration changed row count'; end if;
 select listing_context into c from public.enquiries where id='00000000-0000-4000-8000-000000000001';
 if c->>'listingId'<>'00000000-0000-5000-8000-000000000024' or c->>'listingNumber'<>'100024' or c->>'listingCity'<>'Saint-Sauveur' or c->>'listingPrice'<>'4890000' or c->>'listingUrl'<>'https://proprieteenvente.ca/fr/proprietes/100024/' or c->>'listingSnapshotSource'<>'backfill' then raise exception 'historical listing not resolved: %',c; end if;
 if c->>'listingAddressStatus'<>'unpublished' or c->>'listingAddress'<>'' or c::text like '%DO NOT EXPOSE%' or c::text like '%private@example.test%' then raise exception 'private address/contact leaked'; end if;
 if (select listing_context->>'listingStatus' from public.enquiries where id='00000000-0000-4000-8000-000000000002')<>'unresolved' then raise exception 'missing listing guessed'; end if;
 -- A pre-existing lease keeps its original CSV schema and request payload.
 b=public.claim_enquiry_batch();
 if b->>'csvVersion'<>'1' or b->'rows'->0->>'listingCity'<>'forged' then raise exception 'existing email retry changed'; end if;
 perform public.complete_enquiry_batch((b->>'id')::uuid,'synthetic-provider');
 insert into public.enquiries(id,payload,listing_context) values
 ('00000000-0000-4000-8000-000000000003','{"kind":"buyer","name":"UUID buyer","email":"uuid@example.test","listingReference":"00000000-0000-5000-8000-000000000025"}','{"listingCity":"FORGED"}');
 select listing_context into c from public.enquiries where id='00000000-0000-4000-8000-000000000003';
 if c->>'listingAddress'<>'12 Test Street' or c->>'listingCity'<>'Québec' or c->>'listingSnapshotSource'<>'submission' then raise exception 'UUID or server snapshot failed'; end if;
 select payload into original_payload from public.enquiries where id='00000000-0000-4000-8000-000000000003';
 update public.published_listings set property=property||'{"price":999999}' where id='00000000-0000-5000-8000-000000000025';
 perform public.collect_enquiry('00000000-0000-4000-8000-000000000003',original_payload,repeat('c',64));
 if (select listing_context->>'listingPrice' from public.enquiries where id='00000000-0000-4000-8000-000000000003')<>'500000' then raise exception 'snapshot changed on retry'; end if;
 b=public.claim_enquiry_batch();
 if b->>'csvVersion'<>'2' or b->'rows'->0->>'listingStatus'<>'unresolved' then raise exception 'new email lacks context'; end if;
 perform public.complete_enquiry_batch((b->>'id')::uuid,'synthetic-provider2');
 b=public.claim_enquiry_batch();
 if b->'rows'->0->>'listingAddress'<>'12 Test Street' then raise exception 'snapshot missing in email'; end if;
 if has_table_privilege('anon','public.enquiries','select') or has_table_privilege('authenticated','public.enquiries','select') or has_function_privilege('anon','private.enquiry_listing_context(jsonb,text)','execute') then raise exception 'private data exposed'; end if;
end $$;
insert into auth.users(id,email,email_confirmed_at) values('00000000-0000-4000-8000-000000000090','staff@example.test',now());
insert into public.staff_members(user_id,role) values('00000000-0000-4000-8000-000000000090','owner');
set role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000090","aal":"aal1"}',false);
do $$ begin
 if (select payload->>'listingCity' from public.list_buyer_enquiries_managed() where id='00000000-0000-4000-8000-000000000001')<>'Saint-Sauveur' then raise exception 'inbox lacks authoritative context'; end if;
 if (select payload->>'city' from public.list_buyer_enquiries_managed() where id='00000000-0000-4000-8000-000000000001')<>'Montréal' then raise exception 'buyer preferences overwritten'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000099","aal":"aal1"}',false);
do $$ begin
 begin perform public.list_buyer_enquiries_managed(); raise exception 'customer allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
