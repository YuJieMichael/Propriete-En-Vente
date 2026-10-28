begin;

create function private.normalize_listing_keyword(p_text text) returns text
language sql immutable security invoker set search_path='' as $$
 select translate(lower(btrim(coalesce(p_text,''))),'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ','aaaaaaceeeeiiiinooooouuuuyy');
$$;
create table private.listing_keywords (
 id uuid primary key default gen_random_uuid(),
 labels jsonb not null,
 synonyms text[] not null default '{}',
 revision integer not null default 1,
 updated_at timestamptz not null default now()
);
create unique index listing_keyword_en_unique on private.listing_keywords(private.normalize_listing_keyword(labels->>'en'));
create table private.listing_keyword_links (
 listing_id uuid not null references public.listing_submissions(id),
 keyword_id uuid not null references private.listing_keywords(id),
 primary key(listing_id,keyword_id)
);
create index listing_keyword_links_keyword_idx on private.listing_keyword_links(keyword_id,listing_id);
alter table private.listing_keywords enable row level security;
alter table private.listing_keyword_links enable row level security;
revoke all on private.listing_keywords,private.listing_keyword_links from public,anon,authenticated;
revoke all on function private.normalize_listing_keyword(text) from public,anon,authenticated;

alter table public.listing_submissions add column keyword_revision integer not null default 0;
alter table public.published_listings add column search_keywords jsonb not null default '[]';

create function private.listing_keyword_snapshot(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',k.id,'labels',k.labels,'synonyms',k.synonyms) order by k.labels->>'en',k.id),'[]'::jsonb)
 from private.listing_keyword_links l join private.listing_keywords k on k.id=l.keyword_id where l.listing_id=p_id;
$$;
create function private.publish_listing_keywords() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(723094);
 new.search_keywords:=private.listing_keyword_snapshot(new.id);
 return new;
end $$;
create trigger listing_keyword_publication before insert on public.published_listings
for each row execute function private.publish_listing_keywords();
revoke all on function private.listing_keyword_snapshot(uuid),private.publish_listing_keywords() from public,anon,authenticated;

create function private.list_listing_keywords_admin(p_query text default '',p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare term text; rows jsonb;
begin
 if auth.uid() is null or not private.is_staff() then raise exception 'verified_staff_required' using errcode='42501';end if;
 if p_offset is null or p_offset<0 or p_offset>100000 or p_query is null or length(p_query)>120 then raise exception 'invalid' using errcode='22023';end if;
 term:=private.normalize_listing_keyword(p_query);
 select coalesce(jsonb_agg(row),'[]'::jsonb) into rows from (
  select s.id,s.listing_number::text as reference,s.property->>'title' as title,s.property->>'city' as city,
   s.property->>'type' as type,s.status,s.keyword_revision as revision,
   coalesce((select jsonb_agg(l.keyword_id order by l.keyword_id) from private.listing_keyword_links l where l.listing_id=s.id),'[]'::jsonb) as keyword_ids
  from public.listing_submissions s where s.status<>'uploading' and (
   term='' or strpos(private.normalize_listing_keyword(concat_ws(' ',s.listing_number::text,s.property->>'title',s.property->>'city',s.property->>'type')),term)>0
   or exists(select 1 from private.listing_keyword_links l join private.listing_keywords k on k.id=l.keyword_id where l.listing_id=s.id and strpos(private.normalize_listing_keyword(k.labels::text||' '||array_to_string(k.synonyms,' ')),term)>0)
  ) order by s.created_at desc,s.id limit 51 offset p_offset
 ) row;
 return jsonb_build_object('keywords',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'labels',labels,'synonyms',synonyms,'revision',revision) order by labels->>'fr',id),'[]'::jsonb) from private.listing_keywords),
  'listings',rows,'has_more',jsonb_array_length(rows)>50);
end $$;

create function private.save_listing_keyword(p_id uuid,p_revision integer,p_labels jsonb,p_synonyms text[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare tag private.listing_keywords; v_labels jsonb; v_synonyms text[];
begin
 if auth.uid() is null or not private.is_staff() then raise exception 'verified_staff_required' using errcode='42501';end if;
 if p_revision is null or p_revision<0 or p_labels is null or jsonb_typeof(p_labels)<>'object' or p_synonyms is null then raise exception 'invalid' using errcode='22023';end if;
 if (select count(*) from jsonb_object_keys(p_labels))<>3 or not p_labels ?& array['en','fr','zh']
  or exists(select 1 from jsonb_each(p_labels) where jsonb_typeof(value)<>'string' or length(btrim(value#>>'{}')) not between 1 and 60 or (value#>>'{}') ~ '[[:cntrl:]]')
  or cardinality(p_synonyms)>30 or coalesce(array_ndims(p_synonyms),1)<>1
  or exists(select 1 from unnest(p_synonyms) t where t is null or length(btrim(t)) not between 1 and 80 or t ~ '[[:cntrl:]]') then raise exception 'invalid' using errcode='22023';end if;
 select jsonb_object_agg(key,btrim(value#>>'{}')) into v_labels from jsonb_each(p_labels);
 select coalesce(array_agg(value order by value),'{}'::text[]) into v_synonyms from (select distinct btrim(t) value from unnest(p_synonyms) t) terms;
 perform pg_catalog.pg_advisory_xact_lock(723094);
 if p_id is null then
  if p_revision<>0 or (select count(*) from private.listing_keywords)>=300 then raise exception 'keyword_limit_or_invalid_revision' using errcode='22023';end if;
  insert into private.listing_keywords(labels,synonyms) values(v_labels,v_synonyms) returning * into tag;
 else
  select * into tag from private.listing_keywords where id=p_id for update;
  if not found or tag.revision<>p_revision then raise exception 'conflict' using errcode='40001';end if;
  update private.listing_keywords k set labels=v_labels,synonyms=v_synonyms,revision=k.revision+1,updated_at=now() where k.id=p_id returning * into tag;
  update public.published_listings p set search_keywords=private.listing_keyword_snapshot(p.id) where exists(select 1 from private.listing_keyword_links l where l.listing_id=p.id and l.keyword_id=p_id);
 end if;
 insert into public.audit_events(actor_id,action,metadata) values(auth.uid(),'keyword_saved',jsonb_build_object('keyword_id',tag.id,'revision',tag.revision));
 return jsonb_build_object('id',tag.id,'labels',tag.labels,'synonyms',tag.synonyms,'revision',tag.revision);
end $$;

create function private.apply_listing_keywords(p_listings jsonb,p_keyword_ids uuid[],p_mode text) returns void
language plpgsql security definer set search_path='' as $$
declare ids uuid[];
begin
 if auth.uid() is null or not private.is_staff() then raise exception 'verified_staff_required' using errcode='42501';end if;
 if p_listings is null or jsonb_typeof(p_listings)<>'array' or p_keyword_ids is null or p_mode is null or p_mode not in ('add','remove','replace') then raise exception 'invalid' using errcode='22023';end if;
 if jsonb_array_length(p_listings) not between 1 and 100 or cardinality(p_keyword_ids)>30 or (p_mode<>'replace' and cardinality(p_keyword_ids)=0)
  or coalesce(array_ndims(p_keyword_ids),1)<>1 or array_position(p_keyword_ids,null) is not null
  or (select count(distinct x) from unnest(p_keyword_ids) x)<>cardinality(p_keyword_ids) then raise exception 'invalid' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p_listings) row where jsonb_typeof(row)<>'object' or jsonb_typeof(row->'id') is distinct from 'string' or coalesce(row->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or jsonb_typeof(row->'revision') is distinct from 'number' or coalesce(row->>'revision','') !~ '^(0|[1-9][0-9]{0,8})$') then raise exception 'invalid' using errcode='22023';end if;
 select array_agg((row->>'id')::uuid) into ids from jsonb_array_elements(p_listings) row;
 if (select count(distinct x) from unnest(ids) x)<>cardinality(ids) then raise exception 'duplicate_listing' using errcode='22023';end if;
 -- Match review_listing's order: submission rows, then the metadata lock.
 perform 1 from public.listing_submissions where id=any(ids) order by id for update;
 perform pg_catalog.pg_advisory_xact_lock(723094);
 if (select count(*) from private.listing_keywords where id=any(p_keyword_ids))<>cardinality(p_keyword_ids) then raise exception 'unknown_keyword' using errcode='22023';end if;
 if (select count(*) from public.listing_submissions s join jsonb_array_elements(p_listings) row on (row->>'id')::uuid=s.id where s.status<>'uploading' and s.keyword_revision=(row->>'revision')::integer)<>cardinality(ids) then raise exception 'conflict' using errcode='40001';end if;
 if p_mode='remove' then
  delete from private.listing_keyword_links where listing_id=any(ids) and keyword_id=any(p_keyword_ids);
 else
  if p_mode='replace' then delete from private.listing_keyword_links where listing_id=any(ids) and not(keyword_id=any(p_keyword_ids));end if;
  insert into private.listing_keyword_links(listing_id,keyword_id) select l,k from unnest(ids) l cross join unnest(p_keyword_ids) k on conflict do nothing;
 end if;
 update public.listing_submissions set keyword_revision=keyword_revision+1 where id=any(ids);
 update public.published_listings p set search_keywords=private.listing_keyword_snapshot(p.id) where p.id=any(ids);
 insert into public.audit_events(actor_id,action,metadata) values(auth.uid(),'listing_keywords_changed',jsonb_build_object('listing_ids',ids,'keyword_ids',p_keyword_ids,'mode',p_mode,'count',cardinality(ids)));
end $$;

create function public.list_listing_keywords_admin(p_query text default '',p_offset integer default 0) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.list_listing_keywords_admin(p_query,p_offset);$$;
create function public.save_listing_keyword(p_id uuid,p_revision integer,p_labels jsonb,p_synonyms text[]) returns jsonb
language sql security invoker set search_path='' as $$ select private.save_listing_keyword(p_id,p_revision,p_labels,p_synonyms);$$;
create function public.apply_listing_keywords(p_listings jsonb,p_keyword_ids uuid[],p_mode text) returns void
language sql security invoker set search_path='' as $$ select private.apply_listing_keywords(p_listings,p_keyword_ids,p_mode);$$;
revoke all on function private.list_listing_keywords_admin(text,integer),public.list_listing_keywords_admin(text,integer),private.save_listing_keyword(uuid,integer,jsonb,text[]),public.save_listing_keyword(uuid,integer,jsonb,text[]),private.apply_listing_keywords(jsonb,uuid[],text),public.apply_listing_keywords(jsonb,uuid[],text) from public,anon,authenticated;
grant execute on function private.list_listing_keywords_admin(text,integer),public.list_listing_keywords_admin(text,integer),private.save_listing_keyword(uuid,integer,jsonb,text[]),public.save_listing_keyword(uuid,integer,jsonb,text[]),private.apply_listing_keywords(jsonb,uuid[],text),public.apply_listing_keywords(jsonb,uuid[],text) to authenticated;

-- Bootstrap only factual type labels; original property/contact/enquiry data is untouched.
with definitions(type,labels,synonyms) as (values
 ('hotel-motel','{"en":"Hotels and motels","fr":"Hôtels et motels","zh":"酒店与汽车旅馆"}'::jsonb,array['hotel','motel','hôtel','酒店','汽车旅馆','旅馆']),
 ('daycare','{"en":"Daycares","fr":"Garderies","zh":"托儿所"}'::jsonb,array['daycare','day care','garderie','幼儿园','托兒所']),
 ('land','{"en":"Land","fr":"Terrains","zh":"土地"}'::jsonb,array['terrain','land','地块']),
 ('business','{"en":"Businesses","fr":"Entreprises","zh":"企业"}'::jsonb,array['business','entreprise','生意']),
 ('house','{"en":"Houses","fr":"Maisons","zh":"独立屋"}'::jsonb,array['house','maison','别墅']),
 ('condo','{"en":"Condos","fr":"Condos","zh":"公寓"}'::jsonb,array['condo','apartment','appartement']),
 ('plex','{"en":"Plexes","fr":"Plex","zh":"多户住宅"}'::jsonb,array['plex','duplex','triplex','多戶住宅']),
 ('commercial','{"en":"Commercial properties","fr":"Propriétés commerciales","zh":"商业物业"}'::jsonb,array['commercial','commercial property','商業物業'])
), inserted as (insert into private.listing_keywords(labels,synonyms) select labels,synonyms from definitions returning id,labels)
insert into private.listing_keyword_links(listing_id,keyword_id)
select s.id,k.id from public.listing_submissions s join definitions d on d.type=s.property->>'type' join inserted k on k.labels=d.labels where s.status<>'uploading';
update public.published_listings p set search_keywords=private.listing_keyword_snapshot(p.id);
notify pgrst,'reload schema';
commit;
