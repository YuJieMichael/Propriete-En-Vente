do $$ begin
  if to_regclass('public.broker_applications') is null then raise exception 'broker application records were deleted'; end if;
  if has_table_privilege('anon','public.broker_applications','select') then raise exception 'anonymous can read retained broker records'; end if;
  if has_table_privilege('authenticated','public.broker_applications','select') then raise exception 'authenticated clients can read retained broker records'; end if;
  if to_regprocedure('public.submit_broker_application(text,text,text,text,text,text,boolean)') is not null then raise exception 'broker submission RPC remains'; end if;
  if to_regprocedure('public.review_broker_application(uuid,integer,text,text)') is not null then raise exception 'broker review RPC remains'; end if;
  if to_regprocedure('public.get_verified_brokers()') is not null then raise exception 'broker directory RPC remains'; end if;
end $$;
