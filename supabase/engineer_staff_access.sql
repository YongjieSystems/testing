-- Opt-in assistant operations for a specific engineer membership. Staff privileges
-- remain distinct from manager approval, employee administration and private costs.
alter table public.yj_memberships add column if not exists staff_access boolean not null default false;

create or replace function yj_private.actor_role(p_org uuid) returns text
language sql stable security definer set search_path='' as $$
 select case when role='ENGINEER' and staff_access then 'STAFF' else role end
 from public.yj_memberships where org_id=p_org and user_id=auth.uid() and active;
$$;

-- Keep the engineer's original assigned-task reporting ability as well.
create or replace function yj_private.require_role(p_org uuid,p_roles text[]) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or (
   coalesce(yj_private.actor_role(p_org),'')<>all(p_roles)
   and not ('ENGINEER'=any(p_roles) and exists(
     select 1 from public.yj_memberships where org_id=p_org and user_id=auth.uid()
       and active and role='ENGINEER' and staff_access
   ))
 ) then raise exception '沒有這項操作權限' using errcode='42501'; end if;
end;
$$;
revoke all on function yj_private.actor_role(uuid),yj_private.require_role(uuid,text[]) from public,anon;
grant execute on function yj_private.actor_role(uuid) to authenticated;
