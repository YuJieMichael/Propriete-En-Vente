-- One stable numeric reference follows a listing from submission to publication.
alter table public.listing_submissions add column listing_number bigint generated always as identity(start with 100001) unique;
alter table public.published_listings add column listing_number bigint unique;
update public.published_listings p set listing_number=s.listing_number from public.listing_submissions s where p.id=s.id;
alter table public.published_listings alter column listing_number set not null;
create function private.assign_published_listing_number() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 select s.listing_number into new.listing_number from public.listing_submissions s where s.id=new.id;
 if new.listing_number is null then raise exception 'listing_submission_required'; end if;
 return new;
end $$;
revoke all on function private.assign_published_listing_number() from public,anon,authenticated;
create trigger published_listing_number before insert or update of id,listing_number on public.published_listings
 for each row execute function private.assign_published_listing_number();
