-- Private staff-only workflow state for the buyer enquiry inbox.
alter table public.enquiries
  add column status text not null default 'unread'
    check (status in ('unread', 'read', 'replied'));

drop function public.list_buyer_enquiries(integer);
create function public.list_buyer_enquiries(p_offset integer default 0)
returns table(id uuid, created_at timestamptz, payload jsonb, status text)
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_staff() then
    raise exception 'verified_staff_required' using errcode='42501';
  end if;
  if p_offset is null or p_offset<0 then raise exception 'invalid_offset'; end if;
  return query select e.id,e.created_at,e.payload,e.status from public.enquiries e
    where e.payload->>'kind'='buyer'
    order by e.created_at desc,e.id desc limit 51 offset p_offset;
end;
$$;
revoke all on function public.list_buyer_enquiries(integer) from public,anon;
grant execute on function public.list_buyer_enquiries(integer) to authenticated;

create function public.set_buyer_enquiry_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not private.is_staff() then
    raise exception 'verified_staff_required' using errcode='42501';
  end if;
  if p_status is null or p_status not in ('unread','read','replied') then
    raise exception 'invalid_status' using errcode='22023';
  end if;
  update public.enquiries set status=p_status
    where id=p_id and payload->>'kind'='buyer';
  if not found then raise exception 'buyer_enquiry_not_found' using errcode='P0002'; end if;
end;
$$;
revoke all on function public.set_buyer_enquiry_status(uuid,text) from public,anon;
grant execute on function public.set_buyer_enquiry_status(uuid,text) to authenticated;
