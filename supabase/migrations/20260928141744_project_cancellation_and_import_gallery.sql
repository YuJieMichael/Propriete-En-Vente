begin;
alter table public.projects add column cancelled_at timestamptz;

-- A cancellation preserves the previous review status, files and appointments.
-- Only the project owner can cancel/restore, with optimistic concurrency.
create function public.set_project_cancelled(p_id uuid, p_revision integer, p_cancelled boolean)
returns public.projects language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); v_project public.projects;
begin
  select * into v_project from public.projects where id=p_id for update;
  if not found or v_project.owner_id<>v_uid then raise exception 'Access denied' using errcode='42501'; end if;
  if p_revision is null or v_project.revision<>p_revision then raise exception 'revision conflict' using errcode='40001'; end if;
  if p_cancelled is null then raise exception 'invalid cancellation' using errcode='22023'; end if;
  if (v_project.cancelled_at is not null)=p_cancelled then return v_project; end if;
  update public.projects set cancelled_at=case when p_cancelled then now() else null end,
    revision=revision+1,updated_at=now() where id=p_id returning * into v_project;
  insert into public.audit_events(actor_id,project_id,action)
    values(v_uid,p_id,case when p_cancelled then 'project_cancelled' else 'project_restored' end);
  return v_project;
end $$;
revoke all on function public.set_project_cancelled(uuid,integer,boolean) from public,anon;
grant execute on function public.set_project_cancelled(uuid,integer,boolean) to authenticated;

-- Imported broker galleries can exceed the four-photo public submission limit.
-- reserve_listing and the public input validator retain their four-photo limit.
alter table public.listing_submissions drop constraint listing_submissions_photo_paths_check;
alter table public.listing_submissions add constraint listing_submissions_photo_paths_check
  check(cardinality(photo_paths) between 1 and 100);
commit;
