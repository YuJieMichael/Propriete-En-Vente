begin;
insert into auth.users(id,email,email_confirmed_at) values('12000000-0000-4000-8000-000000000021','reviewer@example.test',now()),('12000000-0000-4000-8000-000000000022','visitor@example.test',now());
insert into public.staff_members(user_id,role,active) values('12000000-0000-4000-8000-000000000021','owner',true);
insert into public.listing_submissions(id,fingerprint,property,contact,photo_paths,status)
values('22000000-0000-4000-8000-000000000021','test','{"title":"Imported property","source":{"provider":"centris"},"description":"Description","descriptionTranslations":{"fr":"Texte"},"coordinates":{"latitude":46,"longitude":-74},"features":[{"key":"year"}],"transaction":"rent","email":"never-public"}','{"email":"private@example.test"}',array['/centris/12345678/001.webp'],'pending');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"12000000-0000-4000-8000-000000000022","aal":"aal2"}',true);
do $$ begin
 begin perform public.list_listing_history('22000000-0000-4000-8000-000000000021');raise exception 'nonstaff read history';exception when insufficient_privilege then null;end;
 begin perform public.review_listing('22000000-0000-4000-8000-000000000021',0,'published','');raise exception 'nonstaff published';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"12000000-0000-4000-8000-000000000021","aal":"aal2"}',true);
select public.review_listing('22000000-0000-4000-8000-000000000021',0,'published','Approved');
do $$ begin
 begin perform public.review_listing('22000000-0000-4000-8000-000000000021',1,'rejected','   ');raise exception 'blank reason allowed';exception when invalid_parameter_value then null;end;
 begin perform public.review_listing('22000000-0000-4000-8000-000000000021',null,'rejected','test');raise exception 'null revision allowed';exception when serialization_failure then null;end;
 begin perform public.review_listing('22000000-0000-4000-8000-000000000021',0,'rejected','test');raise exception 'stale revision allowed';exception when serialization_failure then null;end;
 if (select count(*) from public.list_listing_history('22000000-0000-4000-8000-000000000021'))<>1 then raise exception 'failed actions created audit';end if;
end $$;
select public.review_listing('22000000-0000-4000-8000-000000000021',1,'rejected','Owner requested withdrawal');
do $$ begin
 if exists(select 1 from public.published_listings where id='22000000-0000-4000-8000-000000000021') then raise exception 'still public';end if;
 if not exists(select 1 from public.list_listing_history('22000000-0000-4000-8000-000000000021') where action='listing_withdrawn' and actor='reviewer@example.test' and metadata->>'note'='Owner requested withdrawal' and metadata->>'from_status'='published') then raise exception 'history missing';end if;
end $$;
select public.review_listing('22000000-0000-4000-8000-000000000021',2,'published','Restore');
do $$ begin
 if not exists(select 1 from public.published_listings p join public.listing_submissions s using(id) where p.id='22000000-0000-4000-8000-000000000021' and p.listing_number=s.listing_number and p.property ? 'descriptionTranslations' and p.property ? 'coordinates' and p.property ? 'features' and p.property->>'transaction'='rent' and cardinality(p.photo_paths)=1 and not p.property ? 'email') then raise exception 'restore lost details or leaked data';end if;
 if not exists(select 1 from public.list_listing_history('22000000-0000-4000-8000-000000000021') where action='listing_restored') then raise exception 'restore missing audit';end if;
end $$;
reset role;
-- Legacy records remain readable without inventing a reason or previous state.
insert into public.audit_events(actor_id,action,metadata) values('12000000-0000-4000-8000-000000000021','listing_rejected','{"listing_id":"22000000-0000-4000-8000-000000000021"}');
set local role authenticated;
do $$ begin
 if (select count(*) from public.list_listing_history('22000000-0000-4000-8000-000000000021'))<>4 then raise exception 'legacy missing';end if;
end $$;
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin
 if has_function_privilege('anon','public.list_listing_history(uuid,integer)','execute') or has_table_privilege('anon','public.audit_events','select') then raise exception 'public history exposure';end if;
 if (select count(*) from public.published_listings where id='22000000-0000-4000-8000-000000000021')<>1 then raise exception 'restored listing missing';end if;
end $$;
rollback;
