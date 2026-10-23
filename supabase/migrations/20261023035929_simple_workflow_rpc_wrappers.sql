begin;
create or replace function yj_private.export_inspection(p_case uuid,p_expected integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.yj_cases;v jsonb;
begin
 select * into c from public.yj_cases where id=p_case;
 perform 1 from public.yj_organizations where id=c.org_id for share;
 perform yj_private.require_role(c.org_id,array['MANAGER','STAFF']);
 select * into c from public.yj_cases where id=p_case;
 if c.record_kind<>'INSPECTION' or p_expected is null or c.revision<>p_expected then raise exception '請重新載入最新獨立檢測報價' using errcode='PT409'; end if;
 select record into v from public.yj_quote_versions where case_id=p_case and revision=c.revision;
 return v;
end;$$;
create or replace function yj_private.save_announcement(p_org uuid,p_id uuid,p_expected integer,p_title text,p_body text,p_active boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.yj_announcements;v_id uuid:=coalesce(p_id,gen_random_uuid());
begin
 perform 1 from public.yj_organizations where id=p_org for update;
 perform yj_private.require_role(p_org,array['MANAGER']);
 if p_expected is null or p_expected<0 or p_title is null or length(trim(p_title)) not between 1 and 100 or p_body is null or length(trim(p_body)) not between 1 and 4000 or p_active is null then raise exception '請填公告標題與內容'; end if;
 select * into a from public.yj_announcements where id=v_id for update;
 if found then
  if a.org_id<>p_org then raise exception '沒有此公告權限' using errcode='42501'; end if;
  if a.revision<>p_expected then raise exception '公告已更新，請重新載入' using errcode='PT409'; end if;
 elsif p_id is not null or p_expected<>0 then raise exception '公告不存在，請重新載入' using errcode='PT409'; end if;
 insert into public.yj_announcements(id,org_id,title,body,revision,active,updated_by) values(v_id,p_org,trim(p_title),trim(p_body),coalesce(a.revision,0)+1,p_active,auth.uid())
 on conflict(id) do update set title=excluded.title,body=excluded.body,revision=excluded.revision,active=excluded.active,updated_by=excluded.updated_by,updated_at=now() returning * into a;
 perform yj_private.audit(p_org,'ANNOUNCEMENT_SAVED',a.id,jsonb_build_object('revision',a.revision,'title',a.title,'body',a.body,'active',a.active));
 return to_jsonb(a);
end;$$;
revoke all on function yj_private.export_inspection(uuid,integer),yj_private.save_announcement(uuid,uuid,integer,text,text,boolean) from public,anon,authenticated;
grant execute on function yj_private.export_inspection(uuid,integer),yj_private.save_announcement(uuid,uuid,integer,text,text,boolean) to authenticated;
create or replace function public.yj_export_inspection(p_case uuid,p_expected integer) returns jsonb language sql security invoker set search_path='' as $$select yj_private.export_inspection(p_case,p_expected)$$;
create or replace function public.yj_save_announcement(p_org uuid,p_id uuid,p_expected integer,p_title text,p_body text,p_active boolean) returns jsonb language sql security invoker set search_path='' as $$select yj_private.save_announcement(p_org,p_id,p_expected,p_title,p_body,p_active)$$;
commit;
