begin;

-- Reviewers keep access to the submission and its Storage objects. Every
-- public write (including restore/renewal) projects a confidential listing
-- without any private media references, exact location, or contact fields.
create function private.project_confidential_listing() returns trigger
language plpgsql set search_path='' as $$
declare submitted jsonb;
begin
  select property into submitted from public.listing_submissions where id=new.id;
  if not coalesce(submitted @> '{"confidential":true}'::jsonb,false) then return new; end if;

  if coalesce(submitted#>>'{commercial,scope}','') not in ('property','business','both') then
    raise exception 'invalid_confidential_listing' using errcode='22023';
  end if;

  new.property := (
    select jsonb_object_agg(key,value) from jsonb_each(submitted)
    where key=any(array['title','city','district','price','type','description','mode',
                        'parking','parkingSpaces','streetParking','outdoor','daycareSubsidy','confidential'])
  ) || jsonb_build_object('commercial', jsonb_strip_nulls(jsonb_build_object(
    'scope',submitted#>'{commercial,scope}',
    'rooms',submitted#>'{commercial,rooms}',
    'capacity',submitted#>'{commercial,capacity}'
  )));
  new.photo_paths := array[]::text[];
  new.video_path := null;
  return new;
end $$;
revoke all on function private.project_confidential_listing() from public,anon,authenticated;

-- PostgreSQL orders triggers by name. Run after attach_reviewed_video.
create trigger project_confidential_listing
before insert or update on public.published_listings
for each row execute function private.project_confidential_listing();

-- A separate service-only entry point keeps confidential intake disabled
-- until the publication protection above is installed in the same migration.
create function public.reserve_confidential_listing(
  p_id uuid,p_fingerprint text,p_property jsonb,p_contact jsonb,p_paths text[],p_client_hash text
) returns text language plpgsql security invoker set search_path='' as $$
begin
  if not coalesce(p_property @> '{"confidential":true}'::jsonb,false)
    or coalesce(p_property->>'type','') not in ('commercial','hotel-motel','daycare','business')
    or coalesce(p_property#>>'{commercial,scope}','') not in ('property','business','both')
    or coalesce(btrim(p_contact->>'reviewAddress'),'')='' then
    raise exception 'invalid_confidential_listing' using errcode='22023';
  end if;
  return public.reserve_listing(p_id,p_fingerprint,p_property,p_contact,p_paths,p_client_hash);
end $$;
revoke all on function public.reserve_confidential_listing(uuid,text,jsonb,jsonb,text[],text) from public,anon,authenticated;
grant execute on function public.reserve_confidential_listing(uuid,text,jsonb,jsonb,text[],text) to service_role;

commit;
