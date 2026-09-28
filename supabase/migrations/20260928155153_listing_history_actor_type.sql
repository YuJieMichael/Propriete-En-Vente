begin;
create or replace function private.list_listing_history(p_id uuid,p_offset integer default 0)
returns table(id uuid,created_at timestamptz,action text,actor text,metadata jsonb)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.is_staff() then raise exception 'staff_mfa_required' using errcode='42501'; end if;
  if p_offset is null or p_offset<0 then raise exception 'invalid_offset' using errcode='22023'; end if;
  return query select a.id,a.created_at,a.action,coalesce(u.email::text,a.metadata->>'actor_label',a.actor_id::text),a.metadata
    from public.audit_events a left join auth.users u on u.id=a.actor_id
    where a.metadata->>'listing_id'=p_id::text and a.action in ('listing_published','listing_withdrawn','listing_rejected','listing_restored')
    order by a.created_at desc,a.id desc limit 21 offset p_offset;
end $$;
commit;
