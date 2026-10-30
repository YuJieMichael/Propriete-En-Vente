-- Correct only the seven imported listings whose source facts identify a hotel or motel.
-- Synchronize the review record and public record in one transaction.
begin;
do $$
declare r record; changed integer;
begin
  for r in
    select s.id,s.listing_number,s.property,s.revision
    from public.listing_submissions s
    where s.property#>>'{source,provider}'='centris'
      and s.property#>>'{source,id}' in ('26679587','24397299','28358241','27831614','11097135','15603395','28733627')
      and s.property->>'type'='commercial'
    for update
  loop
    if not exists(select 1 from jsonb_array_elements(r.property->'features') f
      where f->>'key'='Genre de commerce' and f#>>'{value,en}' in ('Hotel','Motel')) then
      raise exception 'Hotel/motel source evidence missing for %',r.listing_number;
    end if;
    update public.listing_submissions set property=jsonb_set(property,'{type}','"hotel-motel"'::jsonb),revision=revision+1 where id=r.id;
    update public.published_listings set property=jsonb_set(property,'{type}','"hotel-motel"'::jsonb)
      where id=r.id and property->>'type'='commercial';
    get diagnostics changed=row_count;
    if changed<>1 then raise exception 'Public listing changed concurrently: %',r.listing_number; end if;
    insert into public.audit_events(action,metadata) values('listing_category_updated',jsonb_build_object(
      'listing_id',r.id,'listing_number',r.listing_number,'from_type','commercial','to_type','hotel-motel',
      'revision',r.revision+1,'actor_label','Codex: hotel/motel category correction',
      'reason','Source business type explicitly identifies Hotel or Motel'));
  end loop;
  if (select count(*) from public.published_listings p join public.listing_submissions s using(id)
    where p.property#>>'{source,provider}'='centris'
      and p.property#>>'{source,id}' in ('26679587','24397299','28358241','27831614','11097135','15603395','28733627')
      and p.property->>'type'='hotel-motel' and s.property->>'type'='hotel-motel')<>7 then
    raise exception 'Expected seven synchronized hotel/motel listings';
  end if;
end $$;
commit;
