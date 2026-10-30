begin;
do $test$
declare
 base_card jsonb; cards jsonb:='[]'; snap jsonb; state jsonb; result jsonb; original jsonb;
 listing_id uuid; first_id uuid; v text; failed boolean; i int;
begin
 if has_function_privilege('anon','public.centris_cloud_state()','execute')
 or has_function_privilege('authenticated','public.apply_centris_cloud_snapshot(jsonb)','execute') then raise exception 'Public sync access'; end if;
 for i in 1..4 loop
   base_card:=jsonb_build_object('sourceId',(88000000+i)::text,'title',i||' Test Street','city','Test City','transaction','sale','price',500000,'rentPrice',null,'taxExtra',false,
     'property',jsonb_build_object('title',i||' Test Street','city','Test City','transaction','sale','price',500000,'rentPrice',null,'taxExtra',false,
       'description','Hand-reviewed motel description','features',jsonb_build_array(jsonb_build_object('rooms',17)),
       'coordinates',jsonb_build_object('latitude',45.5,'longitude',-73.5,'source','google-maps'),
       'source',jsonb_build_object('provider','centris','id',(88000000+i)::text,'brokerId','e6356','url','https://www.centris.ca/fr/test/'||(88000000+i))),
     'photoPaths',jsonb_build_array('/centris/'||(88000000+i)||'/001.webp'));
   cards:=cards||jsonb_build_array(base_card);
 end loop;
 state:=public.centris_cloud_state();
 snap:=jsonb_build_object('brokerId','e6356','complete',true,'capturedAt',now(),'total',4,'cards',cards);
 result:=public.apply_centris_cloud_snapshot(jsonb_build_object('runId','9001-1','expectedVersion',state->>'version','snapshot',snap));
 if result->>'added'<>'4' then raise exception 'New listings not inserted'; end if;
 select m.listing_id into first_id from private.centris_sync_listings m where source_id='88000001';
 select property into original from public.listing_submissions where id=first_id;
 if public.apply_centris_cloud_snapshot(jsonb_build_object('runId','9001-1','expectedVersion','old','snapshot',snap))<>result then raise exception 'Retry not idempotent'; end if;

 -- Preserve manually reviewed facts, while changing only price-related fields.
 cards:=jsonb_set(cards,'{0,price}','499000');
 cards:=jsonb_set(cards,'{0,property,price}','499000');
 state:=public.centris_cloud_state();
 snap:=snap||jsonb_build_object('capturedAt',now()+interval '1 second','cards',cards);
 result:=public.apply_centris_cloud_snapshot(jsonb_build_object('runId','9002-1','expectedVersion',state->>'version','snapshot',snap));
 if result->>'updated'<>'1' then raise exception 'Price not updated'; end if;
 if (select property-'price'-'source' from public.listing_submissions where id=first_id)<>original-'price'-'source' then raise exception 'Editorial facts overwritten'; end if;
 if (select property->>'price' from public.published_listings where id=first_id)<>'499000' then raise exception 'Public price stale'; end if;

 -- One complete missing snapshot must not withdraw a listing.
 cards:=cards-3; state:=public.centris_cloud_state();
 snap:=snap||jsonb_build_object('capturedAt',now()+interval '2 seconds','total',3,'cards',cards);
 result:=public.apply_centris_cloud_snapshot(jsonb_build_object('runId','9003-1','expectedVersion',state->>'version','snapshot',snap));
 if result->>'withdrawn'<>'0' then raise exception 'First absence removed listing'; end if;
 select m.listing_id into listing_id from private.centris_sync_listings m where source_id='88000004';
 if not exists(select 1 from public.published_listings where id=listing_id) then raise exception 'Missing first observation guard'; end if;
 state:=public.centris_cloud_state();
 snap:=snap||jsonb_build_object('capturedAt',now()+interval '3 seconds');
 result:=public.apply_centris_cloud_snapshot(jsonb_build_object('runId','9004-1','expectedVersion',state->>'version','snapshot',snap));
 if result->>'withdrawn'<>'0' then raise exception 'Rapid repeat removed listing'; end if;

 -- Simulate the prior complete observation having occurred yesterday.
 update private.centris_sync_listings set missing_since=now()-interval '21 hours' where source_id='88000004';
 state:=public.centris_cloud_state();snap:=snap||jsonb_build_object('capturedAt',now()+interval '4 seconds');
 result:=public.apply_centris_cloud_snapshot(jsonb_build_object('runId','9005-1','expectedVersion',state->>'version','snapshot',snap));
 if result->>'withdrawn'<>'1' or exists(select 1 from public.published_listings where id=listing_id)
 or not exists(select 1 from public.listing_submissions where id=listing_id) then raise exception 'Soft withdrawal failed'; end if;

 -- An automatically withdrawn listing returns under the same identity/reference.
 cards:=cards||jsonb_build_array(base_card);state:=public.centris_cloud_state();
 snap:=snap||jsonb_build_object('capturedAt',now()+interval '5 seconds','total',4,'cards',cards);
 result:=public.apply_centris_cloud_snapshot(jsonb_build_object('runId','9006-1','expectedVersion',state->>'version','snapshot',snap));
 if result->>'restored'<>'1' or not exists(select 1 from public.published_listings where id=listing_id) then raise exception 'Restore failed'; end if;

 -- Stale admin edits, duplicate IDs and partial fetches must roll back completely.
 state:=public.centris_cloud_state();
 update public.listing_submissions set revision=revision+1 where id=first_id;
 failed:=false;
 begin perform public.apply_centris_cloud_snapshot(jsonb_build_object('runId','9007-1','expectedVersion',state->>'version','snapshot',snap||jsonb_build_object('capturedAt',now()+interval '6 seconds')));
 exception when others then failed:=true; end;
 if not failed then raise exception 'Concurrent edit not detected'; end if;
 state:=public.centris_cloud_state();failed:=false;
 begin perform public.apply_centris_cloud_snapshot(jsonb_build_object('runId','9008-1','expectedVersion',state->>'version','snapshot',snap||jsonb_build_object('complete',false)));
 exception when others then failed:=true; end;
 if not failed then raise exception 'Partial catalogue accepted'; end if;
 failed:=false;
 begin perform public.apply_centris_cloud_snapshot(jsonb_build_object('runId','9009-1','expectedVersion',state->>'version','snapshot',snap||jsonb_build_object('cards',cards||jsonb_build_array(base_card),'total',5)));
 exception when others then failed:=true; end;
 if not failed then raise exception 'Duplicate IDs accepted'; end if;
 if (select count(*) from private.centris_sync_runs where run_id like '900%')<>6 then raise exception 'Failed run persisted'; end if;
end $test$;
rollback;
