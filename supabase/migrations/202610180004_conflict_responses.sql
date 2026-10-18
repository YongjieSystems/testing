begin;
-- A user editing an old version is an HTTP conflict, not a transient transaction failure.
do $$
declare item record;
begin
 for item in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'yj_%' and position('40001' in pg_get_functiondef(p.oid))>0 loop
 execute replace(pg_get_functiondef(item.oid),'''40001''','''PT409''');
 end loop;
end;
$$;
alter policy membership_read on public.yj_memberships using(user_id=(select auth.uid()) or yj_private.actor_role(org_id)='MANAGER');
create index on yj_private.bootstrap_challenges(org_id);
create policy bootstrap_deny_clients on yj_private.bootstrap_challenges for all to anon,authenticated using(false) with check(false);
commit;
