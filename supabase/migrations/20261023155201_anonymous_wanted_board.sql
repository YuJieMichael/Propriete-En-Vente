-- Prepared for a CLI-generated migration. Apply only after review.
begin;

create table private.wanted_requests (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  card jsonb not null,
  status text not null default 'pending' check (status in ('pending','published','rejected','withdrawn')),
  revision integer not null default 0,
  review_note text not null default '',
  reviewed_by uuid references auth.users(id) on delete set null,
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '90 days')
);
create index wanted_requests_public on private.wanted_requests(status,created_at desc);
create index wanted_requests_owner on private.wanted_requests(owner_id,created_at desc);
create table private.wanted_replies (
  id uuid primary key,
  request_id uuid not null references private.wanted_requests(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (length(message) between 10 and 1500),
  listing_number text,
  created_at timestamptz not null default now(),
  unique(request_id,sender_id)
);
create index wanted_replies_sender on private.wanted_replies(sender_id,created_at desc);
alter table private.wanted_requests enable row level security;
alter table private.wanted_replies enable row level security;
revoke all on private.wanted_requests,private.wanted_replies from public,anon,authenticated;

-- Public projections never include account identifiers, names, email addresses,
-- moderation notes, or responses. Free text is never part of a public card.
create function private.wanted_public_card(r private.wanted_requests)
returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_object('id',r.id,'propertyType',r.card->'propertyType','city',r.card->'city',
    'budgetMin',r.card->'budgetMin','budgetMax',r.card->'budgetMax','beds',r.card->'beds',
    'parking',r.card->'parking','transaction',r.card->'transaction','timeline',r.card->'timeline',
    'createdAt',r.created_at,'expiresAt',r.expires_at);
$$;
revoke all on function private.wanted_public_card(private.wanted_requests) from public,anon,authenticated;

create function private.wanted_verified_user()
returns uuid language plpgsql stable security definer set search_path='' as $$
declare v_id uuid:=auth.uid();
begin
  if v_id is null or not exists(select 1 from auth.users u where u.id=v_id and u.email_confirmed_at is not null
    and not coalesce((to_jsonb(u)->>'is_anonymous')::boolean,false))
    then raise exception 'verified_sign_in_required' using errcode='42501'; end if;
  return v_id;
end $$;
revoke all on function private.wanted_verified_user() from public,anon,authenticated;

-- An anonymous visitor receives only this intentionally public projection.
create function private.wanted_public_list(p_offset integer default 0,p_city text default null,p_type text default null)
returns setof jsonb language sql stable security definer set search_path='' as $$
  select private.wanted_public_card(r) from private.wanted_requests r
  where r.status='published' and r.expires_at>now()
    and (p_city is null or r.card->>'city'=p_city)
    and (p_type is null or r.card->>'propertyType'=p_type)
  order by r.created_at desc,r.id limit 31 offset least(greatest(coalesce(p_offset,0),0),3000);
$$;
revoke all on function private.wanted_public_list(integer,text,text) from public,anon,authenticated;
grant usage on schema private to anon;
grant execute on function private.wanted_public_list(integer,text,text) to anon,authenticated;
create function public.list_wanted_requests(p_offset integer default 0,p_city text default null,p_type text default null)
returns setof jsonb language sql stable security invoker set search_path='' as $$
  select * from private.wanted_public_list(p_offset,p_city,p_type);
$$;
revoke all on function public.list_wanted_requests(integer,text,text) from public,anon,authenticated;
grant execute on function public.list_wanted_requests(integer,text,text) to anon,authenticated;

-- One guarded private dispatcher keeps privileged database code out of the
-- exposed schema. The public RPC wrappers below are SECURITY INVOKER.
create function private.wanted_action(p_action text,p_args jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_user uuid;
  v_id uuid;
  v_request_id uuid;
  v_card jsonb;
  v_row private.wanted_requests;
  v_reply private.wanted_replies;
  v_status text;
  v_message text;
  v_listing text;
  v_staff boolean;
  v_result jsonb;
begin
  v_user:=private.wanted_verified_user();
  v_staff:=private.is_staff();
  if p_action='mine' then
    select coalesce(jsonb_agg(private.wanted_public_card(r)||jsonb_build_object(
      'status',case when r.status in ('pending','published') and r.expires_at<=now() then 'expired' else r.status end,
      'revision',r.revision,'reviewNote',r.review_note,
      'replyCount',(select count(*) from private.wanted_replies q where q.request_id=r.id)) order by r.created_at desc),'[]')
      into v_result from (select * from private.wanted_requests where owner_id=v_user order by created_at desc limit 100) r;
    return v_result;
  elsif p_action='create' then
    if coalesce((p_args->>'consent')::boolean,false) is not true then raise exception 'consent_required'; end if;
    v_id:=(p_args->>'id')::uuid; v_card:=p_args->'card';
    if v_id is null or jsonb_typeof(v_card)<>'object' or v_card is null then raise exception 'invalid'; end if;
    if exists(select 1 from jsonb_object_keys(v_card) k where k not in ('propertyType','city','budgetMin','budgetMax','beds','parking','transaction','timeline'))
      or not v_card ?& array['propertyType','city','budgetMin','budgetMax','beds','parking','transaction','timeline']
      or coalesce(v_card->>'propertyType','') not in ('house','condo','plex','land','hotel-motel','daycare','business')
      or coalesce(v_card->>'city','') not in ('Montréal','Québec','Laval','Gatineau','Longueuil','Sherbrooke','Lévis','Trois-Rivières','Saguenay','Terrebonne','Saint-Jean-sur-Richelieu','Repentigny','Brossard','Drummondville','Saint-Jérôme','Granby','Blainville','Saint-Hyacinthe','Shawinigan','Dollard-des-Ormeaux','Rimouski','Victoriaville','Rouyn-Noranda','Saint-Eustache','Magog','Vaudreuil-Dorion','Châteauguay','Mirabel','Mascouche','Côte-Saint-Luc','Saint-Georges','Val-d’Or','Salaberry-de-Valleyfield','Joliette','Thetford Mines','Alma','Sept-Îles','Baie-Comeau','Amos','Gaspé')
      or coalesce(v_card->>'transaction','') not in ('sale','rent')
      or coalesce(v_card->>'timeline','') not in ('now','3-months','6-months','flexible')
      or jsonb_typeof(v_card->'budgetMin')<>'number' or jsonb_typeof(v_card->'budgetMax')<>'number'
      or coalesce(v_card->>'budgetMin','') !~ '^[0-9]{1,10}$' or coalesce(v_card->>'budgetMax','') !~ '^[0-9]{1,10}$'
      or (v_card->>'budgetMin')::bigint>1000000000 or (v_card->>'budgetMax')::bigint>1000000000
      or (v_card->>'budgetMax')::bigint<1 or (v_card->>'budgetMin')::bigint>(v_card->>'budgetMax')::bigint
      or (v_card->'beds'<>'null'::jsonb and (jsonb_typeof(v_card->'beds')<>'number' or coalesce(v_card->>'beds','') !~ '^([0-9]|1[0-9]|20)$'))
      or (v_card->>'propertyType' not in ('house','condo','plex') and v_card->'beds'<>'null'::jsonb)
      or jsonb_typeof(v_card->'parking') not in ('null','boolean') then raise exception 'invalid'; end if;
    perform pg_catalog.pg_advisory_xact_lock(75421,pg_catalog.hashtext(v_user::text));
    select * into v_row from private.wanted_requests where id=v_id;
    if found then
      if v_row.owner_id<>v_user or v_row.card<>v_card then raise exception 'conflict'; end if;
      return to_jsonb(v_row.id);
    end if;
    if (select count(*) from private.wanted_requests where owner_id=v_user and created_at>now()-interval '1 day')>=3
      or (select count(*) from private.wanted_requests where owner_id=v_user and status in ('pending','published') and expires_at>now())>=3
      then raise exception 'rate_limit'; end if;
    insert into private.wanted_requests(id,owner_id,card) values(v_id,v_user,v_card);
    return to_jsonb(v_id);
  elsif p_action='withdraw' then
    v_id:=(p_args->>'id')::uuid;
    select * into v_row from private.wanted_requests where id=v_id and owner_id=v_user for update;
    if not found then raise exception 'not_found' using errcode='42501'; end if;
    if v_row.status<>'withdrawn' then
      update private.wanted_requests set status='withdrawn',revision=revision+1 where id=v_id;
    end if;
    return 'null';
  elsif p_action='reply' then
    v_id:=(p_args->>'id')::uuid; v_request_id:=(p_args->>'requestId')::uuid;
    v_message:=btrim(p_args->>'message'); v_listing:=nullif(btrim(p_args->>'listingNumber'),'');
    if v_id is null or v_request_id is null or coalesce(length(v_message),0) not between 10 and 1500
      or v_message ~ '[\x00-\x08\x0B\x0C\x0E-\x1F]'
      or (v_listing is not null and (length(v_listing)>12 or v_listing !~ '^[0-9]+$')) then raise exception 'invalid'; end if;
    perform pg_catalog.pg_advisory_xact_lock(75422,pg_catalog.hashtext(v_user::text));
    select * into v_row from private.wanted_requests where id=v_request_id for update;
    if not found or v_row.owner_id=v_user then raise exception 'not_available'; end if;
    select * into v_reply from private.wanted_replies where id=v_id;
    if found then
      if v_reply.sender_id<>v_user or v_reply.request_id<>v_request_id or v_reply.message<>v_message or v_reply.listing_number is distinct from v_listing then raise exception 'conflict'; end if;
      return to_jsonb(v_reply.id);
    end if;
    if v_row.status<>'published' or v_row.expires_at<=now() then raise exception 'not_available'; end if;
    if v_listing is not null and not exists(select 1 from public.published_listings where listing_number::text=v_listing) then raise exception 'listing_not_found'; end if;
    if exists(select 1 from private.wanted_replies where request_id=v_request_id and sender_id=v_user) then raise exception 'already_replied'; end if;
    if (select count(*) from private.wanted_replies where sender_id=v_user and created_at>now()-interval '1 day')>=10 then raise exception 'rate_limit'; end if;
    insert into private.wanted_replies(id,request_id,sender_id,message,listing_number) values(v_id,v_request_id,v_user,v_message,v_listing);
    return to_jsonb(v_id);
  elsif p_action='replies' then
    v_request_id:=(p_args->>'requestId')::uuid;
    select coalesce(jsonb_agg(limited.row_data order by limited.created_at desc,limited.id desc),'[]') into v_result from (
      select jsonb_build_object('id',q.id,'requestId',q.request_id,'message',q.message,
        'listingNumber',q.listing_number,'createdAt',q.created_at,'card',private.wanted_public_card(r)) as row_data,q.created_at,q.id
      from private.wanted_replies q join private.wanted_requests r on r.id=q.request_id
      where (v_request_id is null and q.sender_id=v_user)
        or (v_request_id is not null and q.request_id=v_request_id and (r.owner_id=v_user or q.sender_id=v_user or v_staff))
      order by q.created_at desc,q.id desc limit 100
    ) limited;
    return v_result;
  elsif p_action='review-list' then
    if not v_staff then raise exception 'staff_mfa_required' using errcode='42501'; end if;
    v_status:=coalesce(p_args->>'status','pending');
    if v_status not in ('pending','published','rejected','withdrawn') then raise exception 'invalid'; end if;
    select coalesce(jsonb_agg(private.wanted_public_card(r)||jsonb_build_object('status',r.status,'revision',r.revision,'reviewNote',r.review_note,
      'replyCount',(select count(*) from private.wanted_replies q where q.request_id=r.id)) order by r.created_at),'[]') into v_result
      from (select * from private.wanted_requests where status=v_status order by created_at,id limit 31
        offset least(greatest(coalesce((p_args->>'offset')::integer,0),0),3000)) r;
    return v_result;
  elsif p_action='review' then
    if not v_staff then raise exception 'staff_mfa_required' using errcode='42501'; end if;
    v_id:=(p_args->>'id')::uuid; v_status:=p_args->>'decision';
    if v_status not in ('published','rejected') or coalesce(length(p_args->>'note'),0)>1000 then raise exception 'invalid'; end if;
    select * into v_row from private.wanted_requests where id=v_id for update;
    if not found or v_row.revision is distinct from (p_args->>'revision')::integer or v_row.status='withdrawn' then raise exception 'conflict'; end if;
    if v_status='published' and (v_row.status<>'pending' or v_row.expires_at<=now()) then raise exception 'not_pending'; end if;
    update private.wanted_requests set status=v_status,review_note=coalesce(p_args->>'note',''),reviewed_by=v_user,revision=revision+1 where id=v_id;
    insert into public.audit_events(actor_id,action,metadata) values(v_user,'wanted_'||v_status,jsonb_build_object('request_id',v_id));
    return 'null';
  end if;
  raise exception 'invalid_action';
end $$;
revoke all on function private.wanted_action(text,jsonb) from public,anon,authenticated;
grant execute on function private.wanted_action(text,jsonb) to authenticated;

create function public.get_my_wanted_requests() returns setof jsonb language sql security invoker set search_path='' as $$
  select jsonb_array_elements(private.wanted_action('mine'));
$$;
create function public.create_wanted_request(p_id uuid,p_card jsonb,p_consent boolean) returns uuid language sql security invoker set search_path='' as $$
  select (private.wanted_action('create',jsonb_build_object('id',p_id,'card',p_card,'consent',p_consent))#>>'{}')::uuid;
$$;
create function public.withdraw_wanted_request(p_id uuid) returns void language sql security invoker set search_path='' as $$
  select private.wanted_action('withdraw',jsonb_build_object('id',p_id));
$$;
create function public.send_wanted_reply(p_id uuid,p_request_id uuid,p_message text,p_listing_number text default null) returns uuid language sql security invoker set search_path='' as $$
  select (private.wanted_action('reply',jsonb_build_object('id',p_id,'requestId',p_request_id,'message',p_message,'listingNumber',p_listing_number))#>>'{}')::uuid;
$$;
create function public.list_wanted_replies(p_request_id uuid default null) returns setof jsonb language sql security invoker set search_path='' as $$
  select jsonb_array_elements(private.wanted_action('replies',jsonb_build_object('requestId',p_request_id)));
$$;
create function public.list_wanted_review(p_status text default 'pending',p_offset integer default 0) returns setof jsonb language sql security invoker set search_path='' as $$
  select jsonb_array_elements(private.wanted_action('review-list',jsonb_build_object('status',p_status,'offset',p_offset)));
$$;
create function public.review_wanted_request(p_id uuid,p_revision integer,p_decision text,p_note text default '') returns void language sql security invoker set search_path='' as $$
  select private.wanted_action('review',jsonb_build_object('id',p_id,'revision',p_revision,'decision',p_decision,'note',p_note));
$$;
revoke all on function public.get_my_wanted_requests(),public.create_wanted_request(uuid,jsonb,boolean),
  public.withdraw_wanted_request(uuid),public.send_wanted_reply(uuid,uuid,text,text),public.list_wanted_replies(uuid),
  public.list_wanted_review(text,integer),public.review_wanted_request(uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.get_my_wanted_requests(),public.create_wanted_request(uuid,jsonb,boolean),
  public.withdraw_wanted_request(uuid),public.send_wanted_reply(uuid,uuid,text,text),public.list_wanted_replies(uuid),
  public.list_wanted_review(text,integer),public.review_wanted_request(uuid,integer,text,text) to authenticated;
commit;
