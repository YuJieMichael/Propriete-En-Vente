-- Only the authenticated cloud function may call these RPCs. No browser grants.
create table private.centris_sync_listings (
  listing_id uuid primary key references public.listing_submissions(id),
  source_id text not null unique check(source_id ~ '^[0-9]{7,8}$'),
  last_seen timestamptz not null default now(),
  missing_since timestamptz,
  auto_withdrawn boolean not null default false
);
create table private.centris_sync_runs (
  run_id text primary key,
  captured_at timestamptz not null,
  completed_at timestamptz not null default now(),
  snapshot jsonb not null,
  before_rows jsonb not null,
  result jsonb not null
);
revoke all on private.centris_sync_listings,private.centris_sync_runs from public,anon,authenticated;
alter table private.centris_sync_listings enable row level security;
alter table private.centris_sync_runs enable row level security;

-- Reviewed baseline: only Tian Shu Lu's 29 published records, not other brokers.
insert into private.centris_sync_listings(listing_id,source_id)
select id,property#>>'{source,id}' from public.published_listings
where property#>>'{source,provider}'='centris' and property#>>'{source,id}'=any(array[
 '11078212','11097135','11203229','11809271','12076073','13197652','14236984','15067975','15566726','15603395',
 '17908403','19078347','19192949','19489343','19869401','23484515','24397299','25164738','25586801','26059437',
 '26679587','27396478','27483813','27905590','28004437','28358241','28391738','28725722','9788011']);

create function private.centris_cloud_revision() returns text language sql stable security definer set search_path='' as $$
 select md5(coalesce(string_agg(jsonb_build_array(s.id,s.property,s.photo_paths,s.status,s.revision,p.property,p.photo_paths,m.source_id,m.missing_since,m.auto_withdrawn)::text,'|' order by s.id),''))
 from private.centris_sync_listings m join public.listing_submissions s on s.id=m.listing_id
 left join public.published_listings p on p.id=s.id;
$$;
revoke all on function private.centris_cloud_revision() from public,anon,authenticated;

create function public.centris_cloud_state() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('version',private.centris_cloud_revision(),'rows',coalesce((
 select jsonb_agg(jsonb_build_object('id',s.id,'property',s.property,'photo_paths',s.photo_paths,'status',s.status,
 'revision',s.revision,'listing_number',s.listing_number,'published',p.id is not null,
 'source_id',m.source_id,'missing_since',m.missing_since,'auto_withdrawn',m.auto_withdrawn) order by m.source_id)
 from private.centris_sync_listings m join public.listing_submissions s on s.id=m.listing_id
 left join public.published_listings p on p.id=s.id),'[]'::jsonb),
 'lastRun',(select result from private.centris_sync_runs order by completed_at desc limit 1));
$$;
revoke all on function public.centris_cloud_state() from public,anon,authenticated;
grant execute on function public.centris_cloud_state() to service_role;

create function public.apply_centris_cloud_snapshot(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 snap jsonb:=payload->'snapshot'; card jsonb; rec public.listing_submissions; managed private.centris_sync_listings;
 captured timestamptz:=(snap->>'capturedAt')::timestamptz; ids text[]; current_id uuid; current_source text;
 next_property jsonb; before_rows jsonb; result jsonb; existing_result jsonb; paths text[];
 added int:=0; repriced int:=0; withdrawn int:=0; restored int:=0; relisted int:=0;
 changes jsonb:='[]'; total int; managed_count int;
begin
 perform pg_advisory_xact_lock(hashtext('centris-e6356-sync'));
 if payload->>'runId' !~ '^[0-9]+-[0-9]+$' then raise exception 'Invalid run ID'; end if;
 select r.result into existing_result from private.centris_sync_runs r where run_id=payload->>'runId';
 if found then return existing_result; end if;
 if snap->>'brokerId'<>'e6356' or snap->>'complete'<>'true' or jsonb_typeof(snap->'cards')<>'array'
 or captured<now()-interval '6 hours' or captured>now()+interval '5 minutes' then raise exception 'Incomplete or stale catalogue'; end if;
 total:=jsonb_array_length(snap->'cards');
 select array_agg(x->>'sourceId') into ids from jsonb_array_elements(snap->'cards') x;
 if total<1 or total>200 or total<>(snap->>'total')::int or total<>(select count(distinct id) from unnest(ids) id)
 or exists(select 1 from unnest(ids) id where id is null or id !~ '^[0-9]{7,8}$') then raise exception 'Invalid catalogue IDs/count'; end if;
 select count(*) into managed_count from private.centris_sync_listings m join public.published_listings p on p.id=m.listing_id;
 if total<managed_count*0.75 then raise exception 'Large catalogue reduction requires review'; end if;
 if payload->>'expectedVersion' is distinct from private.centris_cloud_revision() then raise exception 'Listings changed since snapshot; rerun'; end if;
 if exists(select 1 from private.centris_sync_runs where captured_at>=captured) then raise exception 'Out-of-order snapshot'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('submission',to_jsonb(s)-'contact','publication',to_jsonb(p),'sync',to_jsonb(m))),'[]')
 into before_rows from private.centris_sync_listings m join public.listing_submissions s on s.id=m.listing_id left join public.published_listings p on p.id=s.id;

 for card in select * from jsonb_array_elements(snap->'cards') loop
   if card->>'transaction' not in ('sale','rent','sale-rent') or (card->>'price')::numeric<=0 or (card->>'price')::numeric>1e9
   or (card->>'price') is null or jsonb_typeof(card->'taxExtra')<>'boolean'
   or (card->>'transaction' in ('rent','sale-rent') and (coalesce((card->>'rentPrice')::numeric,0)<=0)) then raise exception 'Invalid transaction/price'; end if;
   current_source:=card->>'sourceId';
   select * into managed from private.centris_sync_listings where source_id=current_source for update;
   current_id:=managed.listing_id;
   if current_id is null and card->>'replacesSourceId' is not null then
     if card->>'replacesSourceId'=any(ids) then raise exception 'Relist source still active'; end if;
     select * into managed from private.centris_sync_listings where source_id=card->>'replacesSourceId' for update;
     if not found then raise exception 'Unknown relist source'; end if;
     select * into rec from public.listing_submissions where id=managed.listing_id for update;
     if lower(regexp_replace(rec.property->>'title','[^[:alnum:]]','','g'))<>lower(regexp_replace(card->>'title','[^[:alnum:]]','','g'))
     or rec.property->>'city'<>card->>'city' or rec.property->>'transaction'<>card->>'transaction'
     or rec.property->>'title'='Adresse non publiée' then raise exception 'Relist address mismatch'; end if;
     current_id:=managed.listing_id;
     update private.centris_sync_listings set source_id=current_source where listing_id=current_id;
     relisted:=relisted+1;
   end if;
   if current_id is null then
     if exists(select 1 from public.listing_submissions where property#>>'{source,provider}'='centris' and property#>>'{source,id}'=current_source) then raise exception 'Source ID exists outside this job'; end if;
     next_property:=card->'property';
     if next_property#>>'{source,provider}'<>'centris' or next_property#>>'{source,id}'<>current_source
     or next_property#>>'{source,brokerId}'<>'e6356' or next_property->>'title' is null
     or next_property->>'city' is null or next_property->>'price'<>card->>'price'
     or next_property->>'transaction'<>card->>'transaction' then raise exception 'Invalid new property'; end if;
     select array_agg(path) into paths from jsonb_array_elements_text(card->'photoPaths') path;
     if cardinality(paths) not between 1 and 100 or exists(select 1 from unnest(paths) path where path !~ ('^/centris/'||current_source||'/[0-9]{3}\.webp$')) then raise exception 'Invalid photos'; end if;
     current_id:=gen_random_uuid();
     insert into public.listing_submissions(id,fingerprint,property,contact,photo_paths,status,revision,review_note)
       values(current_id,md5('centris-e6356-'||current_source),next_property,'{}',paths,'published',1,'Imported by the daily Centris cloud sync.');
     insert into public.published_listings(id,property,photo_paths) values(current_id,next_property,paths);
     insert into private.centris_sync_listings(listing_id,source_id,last_seen) values(current_id,current_source,captured);
     added:=added+1;
     changes:=changes||jsonb_build_array(jsonb_build_object('id',current_id,'sourceId',current_source,'action','added'));
   else
     select * into rec from public.listing_submissions where id=current_id for update;
     if exists(select 1 from public.published_listings p where p.id=current_id and p.property is distinct from rec.property) then raise exception 'Submission/publication differ; review required'; end if;
     if rec.status<>'published' and not managed.auto_withdrawn then raise exception 'Managed listing was manually unpublished; review required'; end if;
     next_property:=rec.property||jsonb_build_object('price',(card->>'price')::numeric,'rentPrice',card->'rentPrice','taxExtra',(card->>'taxExtra')::boolean,'transaction',card->>'transaction');
     if rec.property#>>'{source,id}'<>current_source then
       next_property:=jsonb_set(jsonb_set(next_property,'{source,id}',to_jsonb(current_source)),'{source,url}',card#>'{property,source,url}');
       if next_property is null then raise exception 'Missing relist URL'; end if;
     end if;
     if next_property is distinct from rec.property then
       next_property:=jsonb_set(next_property,'{source,priceUpdatedAt}',to_jsonb(to_char(captured at time zone 'America/Toronto','YYYY-MM-DD')));
       update public.listing_submissions set property=next_property,revision=revision+1 where id=current_id;
       update public.published_listings set property=next_property where id=current_id;
       repriced:=repriced+1;
       changes:=changes||jsonb_build_array(jsonb_build_object('id',current_id,'sourceId',current_source,'action','updated'));
     end if;
     if managed.auto_withdrawn then
       update public.listing_submissions set status='published',revision=revision+1 where id=current_id;
       insert into public.published_listings(id,property,photo_paths) values(current_id,next_property,rec.photo_paths);
       restored:=restored+1;
       changes:=changes||jsonb_build_array(jsonb_build_object('id',current_id,'sourceId',current_source,'action','restored'));
     end if;
     update private.centris_sync_listings set last_seen=captured,missing_since=null,auto_withdrawn=false where listing_id=current_id;
   end if;
 end loop;

 for managed in select m.* from private.centris_sync_listings m join public.published_listings p on p.id=m.listing_id where not(m.source_id=any(ids)) for update of m loop
   if managed.missing_since is not null and captured-managed.missing_since>=interval '20 hours' then
     -- Remove only the public projection; the source record, photos and backup remain.
     delete from public.published_listings where id=managed.listing_id;
     update public.listing_submissions set status='rejected',revision=revision+1,
       review_note=concat_ws(E'\n',review_note,'Automatically unpublished after two complete Centris snapshots at least 20 hours apart.') where id=managed.listing_id;
     update private.centris_sync_listings set auto_withdrawn=true where listing_id=managed.listing_id;
     withdrawn:=withdrawn+1;
     changes:=changes||jsonb_build_array(jsonb_build_object('id',managed.listing_id,'sourceId',managed.source_id,'action','withdrawn'));
   else
     update private.centris_sync_listings set missing_since=coalesce(missing_since,captured) where listing_id=managed.listing_id;
   end if;
 end loop;
 result:=jsonb_build_object('runId',payload->>'runId','capturedAt',captured,'activeSourceCount',total,'added',added,'updated',repriced,'withdrawn',withdrawn,'restored',restored,'relisted',relisted,'changes',changes);
 insert into private.centris_sync_runs(run_id,captured_at,snapshot,before_rows,result) values(payload->>'runId',captured,snap,before_rows,result);
 insert into public.audit_events(action,metadata) values('centris_cloud_sync_completed',result);
 return result;
end;
$$;
revoke all on function public.apply_centris_cloud_snapshot(jsonb) from public,anon,authenticated;
grant execute on function public.apply_centris_cloud_snapshot(jsonb) to service_role;
