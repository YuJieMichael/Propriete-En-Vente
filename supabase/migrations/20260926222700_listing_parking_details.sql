begin;

-- Preserve the approved structured parking details in the public projection.
create or replace function public.review_listing(p_id uuid,p_revision integer,p_decision text,p_note text default '')
returns void language plpgsql security definer set search_path='' as $$
declare submission public.listing_submissions; public_details jsonb;
begin
  if not private.is_staff() then raise exception 'staff_mfa_required' using errcode='42501'; end if;
  select * into submission from public.listing_submissions where id=p_id for update;
  if not found or submission.revision<>p_revision or submission.status='uploading' then raise exception 'conflict'; end if;
  if p_decision not in ('published','rejected') or length(p_note)>2000 then raise exception 'invalid'; end if;
  if p_decision='published' then
    if submission.status<>'pending' then raise exception 'not_pending'; end if;
    if (select count(*) from storage.objects where bucket_id='listing-photos' and name=any(submission.photo_paths))<>cardinality(submission.photo_paths) then raise exception 'photos_missing'; end if;
    -- Explicit allowlist: never publish private contact, fingerprint or review notes.
    select jsonb_object_agg(key,value) into public_details from jsonb_each(submission.property)
      where key=any(array['title','city','district','postal','price','type','beds','baths','area','description','mode','parking','parkingSpaces','streetParking','outdoor']);
    insert into public.published_listings(id,property,photo_paths) values(p_id,public_details,submission.photo_paths);
  else
    delete from public.published_listings where id=p_id;
  end if;
  update public.listing_submissions set status=p_decision,revision=revision+1,review_note=coalesce(p_note,'') where id=p_id;
  insert into public.audit_events(actor_id,action,metadata) values(auth.uid(),'listing_'||p_decision,jsonb_build_object('listing_id',p_id));
end $$;

commit;
