do $$ begin
  if to_regclass('public.broker_applications') is not null then raise exception 'broker verification table remains'; end if;
  if to_regprocedure('public.submit_broker_application(text,text,text,text,text,text,boolean)') is not null then raise exception 'broker submission RPC remains'; end if;
  if to_regprocedure('public.review_broker_application(uuid,integer,text,text)') is not null then raise exception 'broker review RPC remains'; end if;
  if to_regprocedure('public.get_verified_brokers()') is not null then raise exception 'broker directory RPC remains'; end if;
end $$;
