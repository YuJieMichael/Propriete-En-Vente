begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('15000000-0000-4000-8000-000000000001','keyword-staff@example.test',now()),
 ('15000000-0000-4000-8000-000000000002','keyword-visitor@example.test',now());
insert into public.staff_members(user_id,role,active) values('15000000-0000-4000-8000-000000000001','owner',true);
insert into public.listing_submissions(id,fingerprint,property,contact,photo_paths,status) values
 ('25000000-0000-4000-8000-000000000001','keyword-test','{"title":"Public one","city":"Montréal","type":"hotel-motel","source":{"provider":"centris"},"price":500000}','{"email":"private@example.test"}',array['/centris/12345678/001.webp'],'pending'),
 ('25000000-0000-4000-8000-000000000002','keyword-test','{"title":"Public two","city":"Brossard","type":"daycare"}','{"email":"never-public@example.test"}',array['/centris/12345678/001.webp'],'pending');
create temp table keyword_original as select id,property,contact,revision,status from public.listing_submissions;
grant select on keyword_original to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"15000000-0000-4000-8000-000000000002","aal":"aal2"}',true);
do $$ begin
 begin perform public.list_listing_keywords_admin('',0);raise exception 'nonstaff read';exception when insufficient_privilege then null;end;
 begin perform public.save_listing_keyword(null,0,'{"en":"Lakefront","fr":"Bord de l’eau","zh":"湖畔"}',array['waterfront']);raise exception 'nonstaff saved';exception when insufficient_privilege then null;end;
 begin perform public.apply_listing_keywords('[{"id":"25000000-0000-4000-8000-000000000001","revision":0}]','{}','replace');raise exception 'nonstaff assigned';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"15000000-0000-4000-8000-000000000001","aal":"aal2"}',true);
do $$ declare tag jsonb; tag_id uuid; expected jsonb; result jsonb;begin
 tag:=public.save_listing_keyword(null,0,'{"en":"Lakefront","fr":"Bord de l’eau","zh":"湖畔"}',array['waterfront','湖边']);tag_id:=(tag->>'id')::uuid;
 if tag->>'revision'<>'1' then raise exception 'missing keyword revision';end if;
 expected:='[{"id":"25000000-0000-4000-8000-000000000001","revision":0},{"id":"25000000-0000-4000-8000-000000000002","revision":0}]';
 perform public.apply_listing_keywords(expected,array[tag_id],'add');
 result:=public.list_listing_keywords_admin('waterfront',0);
 if jsonb_array_length(result->'listings')<>2 or result::text like '%private@example%' or result::text like '%fingerprint%' then raise exception 'admin list wrong or leaked unrelated fields';end if;
 begin perform public.apply_listing_keywords(expected,array[tag_id],'remove');raise exception 'stale bulk accepted';exception when serialization_failure then null;end;
 begin perform public.apply_listing_keywords('[{"id":"25000000-0000-4000-8000-000000000001","revision":1},{"id":"25000000-0000-4000-8000-000000000002","revision":0}]',array[tag_id],'remove');raise exception 'partial stale batch accepted';exception when serialization_failure then null;end;
 if jsonb_array_length(public.list_listing_keywords_admin('waterfront',0)->'listings')<>2 then raise exception 'partial changes escaped rollback';end if;
 begin perform public.save_listing_keyword(tag_id,0,'{"en":"Changed","fr":"Modifié","zh":"已修改"}','{}');raise exception 'stale definition accepted';exception when serialization_failure then null;end;
 begin perform public.save_listing_keyword(null,0,'{"en":"Missing languages"}','{}');raise exception 'invalid labels accepted';exception when invalid_parameter_value then null;end;
 begin perform public.save_listing_keyword(null,0,'{"en":"Bad","fr":"Mauvais","zh":"错误"}',array[repeat('x',81)]);raise exception 'long alias accepted';exception when invalid_parameter_value then null;end;
 begin perform public.apply_listing_keywords('[]',array[tag_id],'add');raise exception 'empty batch accepted';exception when invalid_parameter_value then null;end;
 begin perform public.apply_listing_keywords('[{"id":"25000000-0000-4000-8000-000000000001","revision":1}]',array['45000000-0000-4000-8000-000000000099'::uuid],'add');raise exception 'unknown tag accepted';exception when invalid_parameter_value then null;end;
 perform public.apply_listing_keywords('[{"id":"25000000-0000-4000-8000-000000000002","revision":1}]',array[tag_id],'remove');
 if jsonb_array_length(public.list_listing_keywords_admin('waterfront',0)->'listings')<>1 then raise exception 'remove changed unrelated listing';end if;
 perform public.apply_listing_keywords('[{"id":"25000000-0000-4000-8000-000000000002","revision":2}]',array[tag_id],'replace');
 if jsonb_array_length(public.list_listing_keywords_admin('waterfront',0)->'listings')<>2 then raise exception 'replace failed';end if;
 -- Snapshot publication contains keywords, never private contacts.
 perform public.review_listing('25000000-0000-4000-8000-000000000001',0,'published','Approved');
 if not exists(select 1 from public.published_listings where id='25000000-0000-4000-8000-000000000001' and search_keywords @> jsonb_build_array(jsonb_build_object('id',tag_id))) then raise exception 'publish lost tag';end if;
 perform public.save_listing_keyword(tag_id,1,'{"en":"Waterfront updated","fr":"Rive mise à jour","zh":"临水更新"}',array['by the lake','湖边']);
 if not exists(select 1 from public.published_listings p where p.id='25000000-0000-4000-8000-000000000001' and p.search_keywords::text like '%by the lake%' and p.search_keywords::text not like '%waterfront%') then raise exception 'definition edit not reflected';end if;
 perform public.review_listing('25000000-0000-4000-8000-000000000001',1,'rejected','Withdraw');
 if exists(select 1 from public.published_listings where id='25000000-0000-4000-8000-000000000001') then raise exception 'withdraw failed';end if;
 perform public.review_listing('25000000-0000-4000-8000-000000000001',2,'published','Restore');
 if not exists(select 1 from public.published_listings p where p.id='25000000-0000-4000-8000-000000000001' and p.search_keywords::text like '%by the lake%') then raise exception 'republish lost tags';end if;
 if exists(select 1 from public.listing_submissions s join keyword_original o using(id) where s.property<>o.property or s.contact<>o.contact or (s.id<>'25000000-0000-4000-8000-000000000001' and s.revision<>o.revision)) then raise exception 'original listing overwritten';end if;
 if not exists(select 1 from public.audit_events where action='listing_keywords_changed') then raise exception 'missing audit';end if;
end $$;
reset role;
-- Pagination is bounded and does not silently hide later matches.
insert into public.listing_submissions(id,fingerprint,property,contact,photo_paths,status)
select gen_random_uuid(),'pagination',jsonb_build_object('title','Pagination fixture '||n,'city','Keyword Pagination City','type','condo'),'{}',array['/centris/12345678/001.webp'],'pending' from generate_series(1,60) n;
set local role authenticated;
do $$ declare result jsonb;begin
 result:=public.list_listing_keywords_admin('Keyword Pagination City',0);
 if jsonb_array_length(result->'listings')<>51 or result->>'has_more'<>'true' then raise exception 'first page is not bounded';end if;
 result:=public.list_listing_keywords_admin('Keyword Pagination City',50);
 if jsonb_array_length(result->'listings')<>10 or result->>'has_more'<>'false' then raise exception 'later page missing';end if;
end $$;
reset role;
update public.staff_members set active=false where user_id='15000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"15000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
do $$ begin
 begin perform public.list_listing_keywords_admin('',0);raise exception 'inactive staff read';exception when insufficient_privilege then null;end;
end $$;
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin
 if has_function_privilege('anon','public.list_listing_keywords_admin(text,integer)','execute') or has_function_privilege('anon','public.save_listing_keyword(uuid,integer,jsonb,text[])','execute') or has_function_privilege('anon','public.apply_listing_keywords(jsonb,uuid[],text)','execute') then raise exception 'anonymous management exposed';end if;
 if (select count(*) from public.published_listings p where p.id='25000000-0000-4000-8000-000000000001' and p.search_keywords::text like '%by the lake%' and p.search_keywords::text not like '%private@example%')<>1 then raise exception 'public snapshot unreadable or private';end if;
end $$;
rollback;
