begin;
-- First supervisor: one-time project-owner challenge, never available through the Data API.
create table yj_private.bootstrap_challenges (
 token_hash text primary key, org_id uuid not null references public.yj_organizations(id), email text not null,
 expires_at timestamptz not null, used_at timestamptz, completed_at timestamptz
);
revoke all on yj_private.bootstrap_challenges from public,anon,authenticated;
create function public.yj_consume_bootstrap(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row yj_private.bootstrap_challenges;
begin
 if p_token is null or length(p_token) not between 40 and 100 then raise exception '設定連結無效或已過期' using errcode='42501'; end if;
 update yj_private.bootstrap_challenges set used_at=now()
 where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and used_at is null and expires_at>now()
 returning * into v_row;
 if not found then raise exception '設定連結無效或已過期' using errcode='42501'; end if;
 if not exists(select 1 from public.yj_memberships where org_id=v_row.org_id and email=v_row.email and role='MANAGER' and active and user_id is null) then raise exception '主管帳號已設定或已停用' using errcode='42501'; end if;
 return jsonb_build_object('org_id',v_row.org_id,'email',v_row.email);
end;
$$;
create function public.yj_finish_onboarding(p_org uuid,p_email text,p_user uuid,p_actor uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.yj_organizations where id=p_org for update;
 if p_actor is null then
 if not exists(select 1 from yj_private.bootstrap_challenges where org_id=p_org and email=p_email and used_at>now()-interval '10 minutes' and completed_at is null) then raise exception '初始設定尚未授權' using errcode='42501'; end if;
 else
 if not exists(select 1 from public.yj_memberships where org_id=p_org and user_id=p_actor and role='MANAGER' and active) then raise exception '只有主管可開通員工' using errcode='42501'; end if;
 end if;
 if not exists(select 1 from auth.users where id=p_user and lower(email)=lower(p_email) and email_confirmed_at is not null) then raise exception '開通帳號不相符'; end if;
 update public.yj_memberships set user_id=p_user where org_id=p_org and email=lower(p_email) and active and user_id is null;
 if not found then raise exception '帳號已開通或不在啟用名單中'; end if;
 if p_actor is null then update yj_private.bootstrap_challenges set completed_at=now() where org_id=p_org and email=p_email and used_at is not null and completed_at is null; end if;
 insert into public.yj_audit_events(org_id,actor_id,event,entity_id,details) values(p_org,coalesce(p_actor,p_user),'ACCOUNT_ACTIVATED',p_user,jsonb_build_object('email',p_email));
end;
$$;
revoke all on function public.yj_consume_bootstrap(text),public.yj_finish_onboarding(uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.yj_consume_bootstrap(text),public.yj_finish_onboarding(uuid,text,uuid,uuid) to service_role;
grant select on public.yj_memberships to service_role;
commit;
