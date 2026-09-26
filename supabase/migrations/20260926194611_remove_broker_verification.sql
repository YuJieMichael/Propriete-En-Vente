begin;

drop function if exists public.get_verified_brokers();
drop function if exists public.review_broker_application(uuid, integer, text, text);
drop function if exists public.submit_broker_application(text, text, text, text, text, text, boolean);
-- Keep previously submitted application records while removing all client access.
revoke all on public.broker_applications from public, anon, authenticated;
drop policy if exists broker_application_owner_read on public.broker_applications;
drop policy if exists broker_application_staff_read on public.broker_applications;

commit;
