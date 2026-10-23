begin;
insert into auth.users(id,email,email_confirmed_at) values('00000000-0000-4000-8000-000000000099','owner@example.test',now());
insert into public.staff_members(user_id,role) values('00000000-0000-4000-8000-000000000099','owner');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000099","aal":"aal1","session_id":"session-one"}',true);
do $$ begin
  if not public.get_my_staff_access() then raise exception 'password-only owner denied'; end if;
  if has_function_privilege('authenticated','public.finish_staff_email_check(uuid,text,text,uuid)','execute')
    or has_function_privilege('anon','public.begin_staff_email_check(uuid,text,text,uuid)','execute')
    or has_table_privilege('authenticated','private.staff_email_checks','select') then raise exception 'challenge exposed'; end if;
end $$;
reset role;
do $$ declare i integer; begin
  if public.begin_staff_email_check('00000000-0000-4000-8000-000000000099','session-one',repeat('a',64),'00000000-0000-4000-8000-000000000088')<>'ok' then raise exception 'send failed'; end if;
  if public.begin_staff_email_check('00000000-0000-4000-8000-000000000099','session-two',repeat('b',64),'00000000-0000-4000-8000-000000000077')<>'rate_limited' then raise exception 'resend bypass'; end if;
  if public.finish_staff_email_check('00000000-0000-4000-8000-000000000099','session-two',repeat('a',64),'00000000-0000-4000-8000-000000000088') then raise exception 'other session verified'; end if;
  for i in 1..5 loop
    if public.finish_staff_email_check('00000000-0000-4000-8000-000000000099','session-one',repeat('b',64),'00000000-0000-4000-8000-000000000088') then raise exception 'wrong code accepted'; end if;
  end loop;
  if public.finish_staff_email_check('00000000-0000-4000-8000-000000000099','session-one',repeat('a',64),'00000000-0000-4000-8000-000000000088') then raise exception 'attempt limit bypass'; end if;
  update private.staff_email_checks set last_sent_at=now()-interval '61 seconds';
  perform public.begin_staff_email_check('00000000-0000-4000-8000-000000000099','session-one',repeat('c',64),'00000000-0000-4000-8000-000000000077');
  if public.finish_staff_email_check('00000000-0000-4000-8000-000000000099','session-one',repeat('a',64),'00000000-0000-4000-8000-000000000088') then raise exception 'old code accepted'; end if;
  update private.staff_email_checks set expires_at=now()-interval '1 second';
  if public.finish_staff_email_check('00000000-0000-4000-8000-000000000099','session-one',repeat('c',64),'00000000-0000-4000-8000-000000000077') then raise exception 'expired code accepted'; end if;
  update private.staff_email_checks set expires_at=now()+interval '10 minutes';
  if not public.finish_staff_email_check('00000000-0000-4000-8000-000000000099','session-one',repeat('c',64),'00000000-0000-4000-8000-000000000077') then raise exception 'valid code denied'; end if;
  if public.finish_staff_email_check('00000000-0000-4000-8000-000000000099','session-one',repeat('c',64),'00000000-0000-4000-8000-000000000077') then raise exception 'code replay'; end if;
end $$;
set local role authenticated;
do $$ begin if not public.get_my_staff_access() then raise exception 'verified session denied'; end if; end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000099","aal":"aal1","session_id":"session-two"}',true);
do $$ begin if not public.get_my_staff_access() then raise exception 'password-only second session denied'; end if; end $$;
reset role;
do $$ begin
  update public.staff_members set active=false where user_id='00000000-0000-4000-8000-000000000099';
  if public.check_staff_email_session('00000000-0000-4000-8000-000000000099','session-one') then raise exception 'revoked staff allowed'; end if;
  update public.staff_members set active=true where user_id='00000000-0000-4000-8000-000000000099';
  update auth.users set email='changed@example.test' where id='00000000-0000-4000-8000-000000000099';
  if public.check_staff_email_session('00000000-0000-4000-8000-000000000099','session-one') then raise exception 'email change allowed'; end if;
  update auth.users set email='owner@example.test' where id='00000000-0000-4000-8000-000000000099';
  update private.staff_email_checks set verified_until=now()-interval '1 second';
  if public.check_staff_email_session('00000000-0000-4000-8000-000000000099','session-one') then raise exception 'expired grant allowed'; end if;
  update private.staff_email_checks set last_sent_at=now()-interval '61 seconds',send_count=5;
  if public.begin_staff_email_check('00000000-0000-4000-8000-000000000099','session-one',repeat('d',64),'00000000-0000-4000-8000-000000000066')<>'rate_limited' then raise exception 'hour limit bypass'; end if;
end $$;

-- Direct access is granted only to a confirmed, active owner on the private
-- allowlist. The account can enter at AAL1, but cannot inspect that allowlist.
insert into auth.users(id,email,email_confirmed_at)
values('00000000-0000-4000-8000-000000000098','direct-owner@example.test',now());
insert into public.staff_members(user_id,role)
values('00000000-0000-4000-8000-000000000098','owner');
insert into private.staff_password_access_users(user_id)
values('00000000-0000-4000-8000-000000000098');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000098","aal":"aal1","session_id":"direct-owner-session"}',true);
do $$ begin
  if not public.get_my_staff_access() then raise exception 'allowlisted owner denied'; end if;
  if has_table_privilege('authenticated','private.staff_password_access_users','select') then raise exception 'allowlist exposed'; end if;
end $$;
reset role;
update public.staff_members set active=false where user_id='00000000-0000-4000-8000-000000000098';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000098","aal":"aal1","session_id":"direct-owner-session"}',true);
do $$ begin if public.get_my_staff_access() then raise exception 'inactive allowlisted owner allowed'; end if; end $$;
reset role;
rollback;
