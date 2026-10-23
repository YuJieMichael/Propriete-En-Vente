-- Password-only authentication. Authorization still comes from server-managed
-- active staff membership and confirmed email, never user-editable metadata.
create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff_members s
    join auth.users u on u.id = s.user_id
    where s.user_id = auth.uid()
      and s.active
      and s.role in ('owner', 'operator')
      and u.email_confirmed_at is not null
  );
$$;
