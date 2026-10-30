begin;

drop function if exists public.get_verified_brokers();
drop function if exists public.review_broker_application(uuid, integer, text, text);
drop function if exists public.submit_broker_application(text, text, text, text, text, text, boolean);
drop table if exists public.broker_applications;

commit;
