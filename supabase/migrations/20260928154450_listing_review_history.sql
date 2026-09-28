begin;

-- A review and its audit entry commit together. Privileged work stays outside
-- the exposed schema; every entry point repeats the current staff check.
create function private.review_listing(p_id uuid,p_revision integer,p_decision text,p_note text default '')
returns void language plpgsql security definer set search_path='' as $$
declare s public.listing_submissions; details jsonb; note text:=btrim(coalesce(p_note,'')); event text;
begin
  if auth.uid() is null or not private.is_staff() then raise exception 'staff_mfa_required' using errcode='42501'; end if;
  select * into s from public.listing_submissions where id=p_id for update;
  if not found or p_revision is null or s.revision<>p_revision or s.status='uploading' then raise exception 'conflict' using errcode='40001'; end if;
  if p_decision is null or p_decision not in ('published','rejected') or length(note)>2000 then raise exception 'invalid' using errcode='22023'; end if;
  if s.status=p_decision then raise exception 'conflict' using errcode='40001'; end if;
  if p_decision='rejected' and note='' then raise exception 'reason_required' using errcode='22023'; end if;
  if p_decision='published' then
    if exists(select 1 from unnest(s.photo_paths) path where (
      (s.property#>>'{source,provider}'='centris' and path ~ '^/centris/[0-9]{7,8}/[0-9]{3}\.webp$')
      or exists(select 1 from storage.objects where bucket_id='listing-photos' and name=path)
    ) is not true) then raise exception 'photos_missing'; end if;
    select jsonb_object_agg(key,value) into details from jsonb_each(s.property)
      where key=any(array['title','city','district','postal','price','type','beds','baths','area','description','mode','parking','parkingSpaces','streetParking','outdoor','source','lotArea','features','taxExtra','rentPrice','coordinates','transaction','descriptionTranslations']);
    insert into public.published_listings(id,property,photo_paths) values(p_id,details,s.photo_paths);
    event:=case when s.status='rejected' then 'listing_restored' else 'listing_published' end;
  else
    delete from public.published_listings where id=p_id;
    event:=case when s.status='published' then 'listing_withdrawn' else 'listing_rejected' end;
  end if;
  update public.listing_submissions set status=p_decision,revision=revision+1,review_note=note where id=p_id;
  insert into public.audit_events(actor_id,action,metadata) values(auth.uid(),event,jsonb_build_object(
    'listing_id',p_id,'listing_number',s.listing_number,'title',s.property->>'title',
    'from_status',s.status,'to_status',p_decision,'note',note,'revision',s.revision+1));
end $$;

create or replace function public.review_listing(p_id uuid,p_revision integer,p_decision text,p_note text default '')
returns void language sql security invoker set search_path='' as $$
  select private.review_listing(p_id,p_revision,p_decision,p_note);
$$;

create function private.list_listing_history(p_id uuid,p_offset integer default 0)
returns table(id uuid,created_at timestamptz,action text,actor text,metadata jsonb)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.is_staff() then raise exception 'staff_mfa_required' using errcode='42501'; end if;
  if p_offset is null or p_offset<0 then raise exception 'invalid_offset' using errcode='22023'; end if;
  return query select a.id,a.created_at,a.action,coalesce(u.email,a.metadata->>'actor_label',a.actor_id::text),a.metadata
    from public.audit_events a left join auth.users u on u.id=a.actor_id
    where a.metadata->>'listing_id'=p_id::text and a.action in ('listing_published','listing_withdrawn','listing_rejected','listing_restored')
    order by a.created_at desc,a.id desc limit 21 offset p_offset;
end $$;
create function public.list_listing_history(p_id uuid,p_offset integer default 0)
returns table(id uuid,created_at timestamptz,action text,actor text,metadata jsonb)
language sql stable security invoker set search_path='' as $$
  select * from private.list_listing_history(p_id,p_offset);
$$;
revoke all on function private.review_listing(uuid,integer,text,text),public.review_listing(uuid,integer,text,text),private.list_listing_history(uuid,integer),public.list_listing_history(uuid,integer) from public,anon,authenticated;
grant execute on function private.review_listing(uuid,integer,text,text),public.review_listing(uuid,integer,text,text),private.list_listing_history(uuid,integer),public.list_listing_history(uuid,integer) to authenticated;
create index audit_events_listing_history_idx on public.audit_events((metadata->>'listing_id'),created_at desc,id desc) where action in ('listing_published','listing_withdrawn','listing_rejected','listing_restored');
commit;
