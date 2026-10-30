-- Source features explicitly identify these two published imports as Garderie.
-- Only Lachine explicitly discloses subsidized places. Unknown is not non-subsidized.
begin;
do $$
declare r record; changed integer; updated_property jsonb;
begin
  for r in select s.id,s.listing_number,s.property,s.revision
    from public.listing_submissions s
    where s.property#>>'{source,provider}'='centris'
      and s.property#>>'{source,id}' in ('15067975','27396478')
      and s.property->>'type'='commercial' for update
  loop
    if not exists(select 1 from jsonb_array_elements(r.property->'features') f
      where f->>'key'='Genre de commerce' and f#>>'{value,fr}'='Garderie') then
      raise exception 'Daycare source evidence missing for %',r.listing_number;
    end if;
    updated_property=jsonb_set(r.property,'{type}','"daycare"'::jsonb);
    if r.property#>>'{source,id}'='15067975' then
      if not exists(select 1 from jsonb_array_elements(r.property->'features') f
        where f->>'key'='capacity' and f#>>'{value,en}'='80 subsidized places') then
        raise exception 'Subsidy evidence missing';
      end if;
      updated_property=jsonb_set(updated_property,'{daycareSubsidy}','"subsidized"'::jsonb);
    end if;
    update public.published_listings set property=updated_property where id=r.id and property=r.property;
    get diagnostics changed=row_count;
    if changed<>1 then raise exception 'Public listing changed concurrently: %',r.listing_number;end if;
    update public.listing_submissions set property=updated_property,revision=revision+1 where id=r.id;
    insert into public.audit_events(action,metadata) values('listing_category_updated',jsonb_build_object(
      'listing_id',r.id,'listing_number',r.listing_number,'from_type','commercial','to_type','daycare',
      'revision',r.revision+1,'actor_label','Codex: daycare category correction',
      'reason','Source business type explicitly identifies Garderie; subsidy assigned only from explicit capacity evidence'));
  end loop;
  if (select count(*) from public.published_listings p join public.listing_submissions s using(id)
    where p.property#>>'{source,provider}'='centris' and p.property#>>'{source,id}' in ('15067975','27396478')
      and p.property->>'type'='daycare' and s.property=p.property)<>2 then
    raise exception 'Expected two synchronized daycare listings';
  end if;
end $$;
commit;
