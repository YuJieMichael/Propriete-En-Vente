-- Replace email-based staff invitations with a private, owner-only appointment
-- of an account that has already registered. No Auth email is sent.
begin;

drop function public.finish_staff_invite(uuid, uuid);

create function public.appoint_existing_staff(p_actor_id uuid, p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_target_id uuid;
  v_email text := lower(btrim(p_email));
begin
  perform 1 from public.staff_members
    where user_id = p_actor_id and role = 'owner' and active
    for update;
  if not found then
    raise exception 'Only an active platform owner may appoint staff' using errcode = '42501';
  end if;
  if v_email is null or length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid account email' using errcode = '22023';
  end if;

  select id into v_target_id from auth.users where lower(email) = v_email limit 1;
  if v_target_id is null then
    raise exception 'No registered account matches this email' using errcode = 'P0002';
  end if;
  if v_target_id = p_actor_id then
    raise exception 'The platform owner cannot appoint themself' using errcode = '22023';
  end if;
  if exists (select 1 from public.staff_members where user_id = v_target_id) then
    raise exception 'This account already has a staff role' using errcode = '23505';
  end if;

  insert into public.staff_members(user_id, role, active)
    values (v_target_id, 'operator', true);
  insert into public.audit_events(actor_id, action, metadata)
    values (p_actor_id, 'staff_appointed', jsonb_build_object('appointed_user_id', v_target_id, 'role', 'operator'));
end;
$$;

revoke all on function public.appoint_existing_staff(uuid, text) from public, anon, authenticated;
grant execute on function public.appoint_existing_staff(uuid, text) to service_role;

commit;
