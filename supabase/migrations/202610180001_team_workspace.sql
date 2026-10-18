-- Applied by the project owner, never by a browser. No service key is needed in the frontend.
begin;
create schema if not exists yj_private;
revoke all on schema yj_private from public;
grant usage on schema yj_private to authenticated;

create table public.yj_organizations (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 100),
 pricebook jsonb not null, created_at timestamptz not null default now()
);
create table public.yj_memberships (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.yj_organizations(id),
 user_id uuid references auth.users(id), email text not null check(email=lower(email) and length(email)<=254),
 display_name text not null check(length(display_name) between 1 and 100),
 role text not null check(role in ('MANAGER','STAFF','ENGINEER','DRIVER')), active boolean not null default true,
 unique(org_id,email), unique(org_id,user_id)
);
create table public.yj_cases (
 id uuid primary key, org_id uuid not null references public.yj_organizations(id), revision integer not null check(revision>0),
 customer text not null, model text not null, problem text not null, service text not null,
 workflow text not null default 'REVIEW' check(workflow in ('REVIEW','APPROVED','DONE','CANCELLED')),
 assigned_to uuid references auth.users(id), assignment_version integer not null default 0, approved_revision integer, updated_at timestamptz not null default now()
);
create table public.yj_quote_versions (
 case_id uuid not null references public.yj_cases(id), revision integer not null,
 record jsonb not null, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 primary key(case_id,revision)
);
create table public.yj_case_costs (
 case_id uuid primary key references public.yj_cases(id), quote_revision integer not null, costs jsonb not null,
 updated_by uuid not null references auth.users(id), updated_at timestamptz not null default now()
);
create table public.yj_routes (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.yj_organizations(id),
 revision integer not null default 1, name text not null check(length(name) between 1 and 120),
 driver_id uuid not null references auth.users(id), starts_at timestamptz not null, ends_at timestamptz not null,
 status text not null default 'DRAFT' check(status in ('DRAFT','PUBLISHED','DONE','CANCELLED')),
 created_by uuid not null references auth.users(id), check(ends_at>starts_at and ends_at-starts_at<=interval '16 hours')
);
create table public.yj_route_stops (
 id uuid primary key default gen_random_uuid(), route_id uuid not null references public.yj_routes(id),
 case_id uuid not null references public.yj_cases(id), position integer not null check(position between 1 and 30),
 leg text not null check(leg in ('PICKUP','RETURN')), address text not null check(length(address) between 1 and 500),
 starts_at timestamptz not null, ends_at timestamptz not null, check(ends_at>starts_at),
 status text not null default 'PENDING' check(status in ('PENDING','DONE','FAILED')),
 completion_note text not null default '' check(length(completion_note)<=1000), completed_at timestamptz,
 unique(route_id,position), unique(route_id,case_id,leg)
);
create table public.yj_audit_events (
 id bigint generated always as identity primary key, org_id uuid not null references public.yj_organizations(id),
 actor_id uuid not null references auth.users(id), event text not null, entity_id uuid not null,
 details jsonb not null default '{}', created_at timestamptz not null default now()
);
create index on public.yj_cases(org_id,updated_at desc);
create index on public.yj_memberships(user_id) where active;
create index on public.yj_routes(org_id,driver_id,starts_at);
create index on public.yj_route_stops(case_id);

create function yj_private.actor_role(p_org uuid) returns text language sql stable security definer set search_path='' as $$
 select role from public.yj_memberships where org_id=p_org and user_id=auth.uid() and active;
$$;
create function yj_private.can_read_case(p_case uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.yj_cases c where c.id=p_case and (
 yj_private.actor_role(c.org_id) in ('MANAGER','STAFF') or
 (yj_private.actor_role(c.org_id) in ('ENGINEER','DRIVER') and (c.assigned_to=auth.uid() or exists(
 select 1 from public.yj_route_stops s join public.yj_routes r on r.id=s.route_id
 where s.case_id=c.id and r.driver_id=auth.uid() and r.status in ('PUBLISHED','DONE'))))));
$$;
create function yj_private.can_read_route(p_route uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.yj_routes r where r.id=p_route and (
 yj_private.actor_role(r.org_id) in ('MANAGER','STAFF') or
 (yj_private.actor_role(r.org_id) in ('ENGINEER','DRIVER') and r.driver_id=auth.uid() and r.status in ('PUBLISHED','DONE'))));
$$;
create function yj_private.require_role(p_org uuid,p_roles text[]) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(yj_private.actor_role(p_org),'')<>all(p_roles) then
 raise exception '沒有這項操作權限' using errcode='42501'; end if;
end;
$$;
create function yj_private.audit(p_org uuid,p_event text,p_entity uuid,p_details jsonb default '{}') returns void language sql security definer set search_path='' as $$
 insert into public.yj_audit_events(org_id,actor_id,event,entity_id,details) values(p_org,auth.uid(),p_event,p_entity,p_details);
$$;
create function yj_private.amount(p_data jsonb,p_key text,p_required boolean default false) returns numeric language plpgsql immutable set search_path='' as $$
declare v text:=p_data->>p_key;
begin
 if v is null or v='' then if p_required then raise exception '金額尚未填寫：%',p_key; end if; return 0; end if;
 if v!~'^[0-9]{1,7}$' or v::numeric>1000000 then raise exception '金額無效：%',p_key; end if;
 return v::numeric;
end;
$$;

-- All exposed tables have SELECT-only grants. Every mutation uses a checked RPC transaction.
alter table public.yj_organizations enable row level security;
alter table public.yj_memberships enable row level security;
alter table public.yj_cases enable row level security;
alter table public.yj_quote_versions enable row level security;
alter table public.yj_case_costs enable row level security;
alter table public.yj_routes enable row level security;
alter table public.yj_route_stops enable row level security;
alter table public.yj_audit_events enable row level security;
revoke all on public.yj_organizations,public.yj_memberships,public.yj_cases,public.yj_quote_versions,public.yj_case_costs,public.yj_routes,public.yj_route_stops,public.yj_audit_events from anon,authenticated;
grant select on public.yj_organizations,public.yj_memberships,public.yj_cases,public.yj_quote_versions,public.yj_case_costs,public.yj_routes,public.yj_route_stops,public.yj_audit_events to authenticated;
create policy organization_read on public.yj_organizations for select to authenticated using(yj_private.actor_role(id) is not null);
create policy membership_read on public.yj_memberships for select to authenticated using(user_id=auth.uid() or yj_private.actor_role(org_id)='MANAGER');
create policy case_read on public.yj_cases for select to authenticated using(yj_private.can_read_case(id));
create policy quote_read on public.yj_quote_versions for select to authenticated using(exists(select 1 from public.yj_cases c where c.id=case_id and yj_private.actor_role(c.org_id) in ('MANAGER','STAFF')));
create policy cost_read on public.yj_case_costs for select to authenticated using(exists(select 1 from public.yj_cases c where c.id=case_id and yj_private.actor_role(c.org_id)='MANAGER'));
create policy route_read on public.yj_routes for select to authenticated using(yj_private.can_read_route(id));
create policy stop_read on public.yj_route_stops for select to authenticated using(yj_private.can_read_route(route_id));
create policy audit_read on public.yj_audit_events for select to authenticated using(yj_private.actor_role(org_id)='MANAGER');

create function public.yj_join_workspaces() returns void language plpgsql security definer set search_path='' as $$
declare v_email text;
begin
 select lower(email) into v_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if v_email is null then raise exception '請先驗證登入電子郵件' using errcode='42501'; end if;
 update public.yj_memberships set user_id=auth.uid() where email=v_email and user_id is null and active;
end;
$$;
create function public.yj_directory(p_org uuid) returns table(user_id uuid,display_name text,role text) language plpgsql security definer set search_path='' as $$
begin
 perform yj_private.require_role(p_org,array['MANAGER','STAFF']);
 return query select m.user_id,m.display_name,m.role from public.yj_memberships m where m.org_id=p_org and m.active and m.user_id is not null order by m.display_name;
end;
$$;
create function public.yj_set_employee(p_org uuid,p_email text,p_name text,p_role text,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
declare v_old public.yj_memberships;
begin
 perform 1 from public.yj_organizations where id=p_org for update;
 perform yj_private.require_role(p_org,array['MANAGER']);
 if p_role is null or p_role not in ('MANAGER','STAFF','ENGINEER','DRIVER') or p_active is null or length(trim(p_name)) not between 1 and 100 or length(p_email)>254 or p_email!~'^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then raise exception '員工資料不完整'; end if;
 select * into v_old from public.yj_memberships where org_id=p_org and email=lower(trim(p_email));
 if v_old.role='MANAGER' and v_old.active and (p_role<>'MANAGER' or not p_active) and
 (select count(*) from public.yj_memberships where org_id=p_org and role='MANAGER' and active and user_id is not null)<=1 then raise exception '不能停用或降級最後一位已登入主管'; end if;
 insert into public.yj_memberships(org_id,email,display_name,role,active) values(p_org,lower(trim(p_email)),trim(p_name),p_role,p_active)
 on conflict(org_id,email) do update set display_name=excluded.display_name,role=excluded.role,active=excluded.active;
 perform yj_private.audit(p_org,'EMPLOYEE_CHANGED',p_org,jsonb_build_object('email',lower(trim(p_email)),'role',p_role,'active',p_active));
end;
$$;

create function public.yj_save_case(p_org uuid,p_case uuid,p_expected integer,p_record jsonb,p_costs jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_role text; v_old public.yj_cases; v_s jsonb:=p_record->'state'; v_book jsonb; v_record jsonb; v_state jsonb;
 v_revision integer; v_total numeric; v_base numeric; v_transport numeric:=0; v_source numeric; v_id uuid:=coalesce(p_case,gen_random_uuid()); v_key text;
begin
 perform 1 from public.yj_organizations where id=p_org for update;
 perform yj_private.require_role(p_org,array['MANAGER','STAFF']);
 v_role:=yj_private.actor_role(p_org);
 if p_costs is not null and v_role<>'MANAGER' then raise exception '只有主管可同步內部成本' using errcode='42501'; end if;
 if p_expected is null or p_expected<0 or p_record is null or octet_length(p_record::text)>100000 or jsonb_typeof(v_s)<>'object' or v_s->>'schemaVersion'<>'2' then raise exception '請使用新版完整報價'; end if;
 select * into v_old from public.yj_cases where id=v_id for update;
 if found then
 if v_old.org_id<>p_org then raise exception '沒有這項操作權限' using errcode='42501'; end if;
 if v_old.revision<>p_expected then raise exception '資料已由其他人修改，請重新載入最新版本' using errcode='40001'; end if;
 if v_old.workflow in ('DONE','CANCELLED') then raise exception '已結案或取消，請另建新案件'; end if;
 elsif p_expected<>0 then raise exception '案件不存在，請重新整理' using errcode='40001'; end if;
 select pricebook into v_book from public.yj_organizations where id=p_org;
 if v_s->>'service' is null or v_s->>'service' not in ('IN_STORE','ON_SITE','PICKUP') or v_s->>'billingStage' is null or v_s->>'billingStage' not in ('DIAGNOSIS','REPAIR') or
 not(v_book->'INSPECTION' ? coalesce(v_s->>'device','')) or not(v_book->'TRANSPORT' ? coalesce(v_s->>'zone','')) or not(v_book->'URGENCY' ? coalesce(v_s->>'urgency','')) or not(v_book->'SOURCE' ? coalesce(v_s->>'source','')) then raise exception '報價選項無效'; end if;
 if v_s->>'service'='PICKUP' and (v_s->>'logisticsPlan' is null or v_s->>'logisticsPlan' not in ('SCHEDULED','DEDICATED','PRIORITY','COURIER')) then raise exception '收送方案無效'; end if;
 if coalesce(v_s->>'warranty','') not in ('IN','OUT') or coalesce(v_s->>'status','DRAFT') not in ('DRAFT','QUOTED','ACCEPTED','DONE','CANCELLED') then raise exception '報價狀態無效'; end if;
 select coalesce(jsonb_object_agg(key,value),'{}') into v_state from jsonb_each(v_s) where key=any(array['device','zone','service','urgency','source','warranty','billingStage','logisticsPlan','logisticsFee','feeConfirmed','windowConfirmed','routeConfirmed','logisticsWindow','repairFee','repairConfirmed','paidAmount','specialDiscount','contractDiscount','manufacturerFee','otherFee','customerName','deviceModel','staffName','department','status']);
 foreach v_key in array array['customerName','deviceModel','staffName','department','logisticsWindow'] loop
 if length(coalesce(v_state->>v_key,''))>500 then raise exception '欄位過長：%',v_key; end if;
 end loop;
 if length(coalesce(p_record->>'problem',''))>4000 then raise exception '故障描述過長'; end if;
 foreach v_key in array array['paidAmount','specialDiscount','contractDiscount','manufacturerFee','otherFee','repairFee','logisticsFee'] loop
 perform yj_private.amount(v_state,v_key);
 end loop;
 if v_s->>'billingStage'='REPAIR' then v_base:=yj_private.amount(v_s,'repairFee',true); v_source:=0;
 else v_base:=(v_book->'INSPECTION'->(v_s->>'device')->>'price')::numeric;
 v_source:=case when v_s->>'device'='DELIVERY' then 0 else greatest(-v_base,(v_book->'SOURCE'->(v_s->>'source')->>'price')::numeric) end; end if;
 if v_s->>'service'='ON_SITE' then v_transport:=(v_book->'TRANSPORT'->(v_s->>'zone')->>'price')::numeric;
 elsif v_s->>'service'='PICKUP' and v_s->'feeConfirmed'='true'::jsonb then v_transport:=yj_private.amount(v_s,'logisticsFee',true); end if;
 v_total:=greatest(0,v_base+v_transport+(v_book->'URGENCY'->(v_s->>'urgency')->>'price')::numeric+v_source+yj_private.amount(v_s,'manufacturerFee')+yj_private.amount(v_s,'otherFee')-yj_private.amount(v_s,'specialDiscount')-yj_private.amount(v_s,'contractDiscount'));
 v_revision:=coalesce(v_old.revision,0)+1;
 v_state:=v_state||jsonb_build_object('schemaVersion',2,'id',gen_random_uuid(),'caseId',v_id,'date',to_char(now() at time zone 'Asia/Taipei','YYYY-MM-DD'),'pricing',v_book);
 v_record:=jsonb_build_object('state',v_state,'problem',coalesce(p_record->>'problem',''),'total',v_total,'timestamp',to_char(now() at time zone 'Asia/Taipei','YYYY/MM/DD HH24:MI:SS'));
 insert into public.yj_cases(id,org_id,revision,customer,model,problem,service) values(v_id,p_org,v_revision,coalesce(v_s->>'customerName',''),coalesce(v_s->>'deviceModel',''),coalesce(p_record->>'problem',''),v_s->>'service')
 on conflict(id) do update set revision=v_revision,customer=excluded.customer,model=excluded.model,problem=excluded.problem,service=excluded.service,workflow='REVIEW',approved_revision=null,updated_at=now();
 insert into public.yj_quote_versions(case_id,revision,record,created_by) values(v_id,v_revision,v_record,auth.uid());
 if p_costs is not null then
 if jsonb_typeof(p_costs)<>'object' or octet_length(p_costs::text)>20000 then raise exception '成本資料無效'; end if;
 select coalesce(jsonb_object_agg(key,value),'{}') into p_costs from jsonb_each(p_costs) where key=any(array['logisticsMinutes','hourlyCost','travelCost','logisticsOtherCost','targetMargin','actualMinutes','actualEngineerMinutes','actualHourlyCost','actualTravelCost','actualOtherCost','actualRevenue','actualNotes','actualConfirmed']);
 foreach v_key in array array['logisticsMinutes','hourlyCost','travelCost','logisticsOtherCost','targetMargin','actualMinutes','actualEngineerMinutes','actualHourlyCost','actualTravelCost','actualOtherCost','actualRevenue'] loop perform yj_private.amount(p_costs,v_key); end loop;
 if length(coalesce(p_costs->>'actualNotes',''))>500 then raise exception '成本備註過長'; end if;
 if p_costs->'actualConfirmed'='true'::jsonb then
 foreach v_key in array array['actualMinutes','actualEngineerMinutes','actualHourlyCost','actualTravelCost','actualOtherCost','actualRevenue'] loop perform yj_private.amount(p_costs,v_key,true); end loop;
 if yj_private.amount(p_costs,'actualEngineerMinutes')>yj_private.amount(p_costs,'actualMinutes') then raise exception '工程師工時不得超過總工時'; end if;
 end if;
 insert into public.yj_case_costs(case_id,quote_revision,costs,updated_by) values(v_id,v_revision,p_costs,auth.uid())
 on conflict(case_id) do update set quote_revision=excluded.quote_revision,costs=excluded.costs,updated_by=excluded.updated_by,updated_at=now();
 end if;
 perform yj_private.audit(p_org,'CASE_SAVED',v_id,jsonb_build_object('revision',v_revision,'total',v_total));
 return jsonb_build_object('id',v_id,'revision',v_revision,'record',v_record);
end;
$$;

create function public.yj_approve_case(p_case uuid,p_expected integer,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare c public.yj_cases; s jsonb;
begin
 select org_id into c.org_id from public.yj_cases where id=p_case;
 perform 1 from public.yj_organizations where id=c.org_id for update;
 select * into c from public.yj_cases where id=p_case for update;
 perform yj_private.require_role(c.org_id,array['MANAGER']);
 if p_expected is null or c.revision<>p_expected or c.workflow<>'REVIEW' then raise exception '案件已變更，請重新載入後核准' using errcode='40001'; end if;
 if length(trim(coalesce(p_reason,''))) not between 1 and 500 then raise exception '請記錄核准理由'; end if;
 select record->'state' into s from public.yj_quote_versions where case_id=c.id and revision=c.revision;
 if s->>'service'='PICKUP' then
 perform yj_private.amount(s,'logisticsFee',true);
 if s->'feeConfirmed'<>'true'::jsonb or s->'windowConfirmed'<>'true'::jsonb or s->'feeConfirmed' is null or s->'windowConfirmed' is null or length(trim(coalesce(s->>'logisticsWindow','')))=0 or s->>'device'='DELIVERY' then raise exception '收送範圍、費用與取回時段尚未確認，或代送項目重疊'; end if;
 end if;
 if s->>'billingStage'='REPAIR' and s->'repairConfirmed' is distinct from 'true'::jsonb then raise exception '維修金額尚未取得客戶同意'; end if;
 update public.yj_cases set approved_revision=revision,workflow='APPROVED',updated_at=now() where id=c.id;
 perform yj_private.audit(c.org_id,'CASE_APPROVED',c.id,jsonb_build_object('revision',c.revision,'reason',p_reason));
end;
$$;
create function public.yj_assign_case(p_case uuid,p_expected integer,p_engineer uuid) returns void language plpgsql security definer set search_path='' as $$
declare c public.yj_cases;
begin
 select org_id into c.org_id from public.yj_cases where id=p_case;
 perform 1 from public.yj_organizations where id=c.org_id for update;
 select * into c from public.yj_cases where id=p_case for update;
 perform yj_private.require_role(c.org_id,array['MANAGER']);
 if p_expected is null or c.assignment_version<>p_expected then raise exception '分派已變更' using errcode='40001'; end if;
 if p_engineer is not null and not exists(select 1 from public.yj_memberships where org_id=c.org_id and user_id=p_engineer and active and role='ENGINEER') then raise exception '請選擇有效工程師'; end if;
 update public.yj_cases set assigned_to=p_engineer,assignment_version=assignment_version+1,updated_at=now() where id=c.id;
 perform yj_private.audit(c.org_id,'CASE_ASSIGNED',c.id,jsonb_build_object('engineer',p_engineer));
end;
$$;

create function public.yj_save_route(p_org uuid,p_route uuid,p_expected integer,p_name text,p_driver uuid,p_start timestamptz,p_end timestamptz,p_stops jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.yj_routes; v_id uuid:=coalesce(p_route,gen_random_uuid()); v_revision integer; s jsonb; v_position integer:=0; v_last timestamptz:=p_start; v_start timestamptz; v_end timestamptz;
begin
 perform 1 from public.yj_organizations where id=p_org for update;
 perform yj_private.require_role(p_org,array['MANAGER','STAFF']);
 if p_expected is null or p_expected<0 then raise exception '版本無效'; end if;
 select * into r from public.yj_routes where id=v_id for update;
 if found then
 if r.org_id<>p_org then raise exception '沒有這項操作權限' using errcode='42501'; end if;
 if p_expected is null or r.revision<>p_expected or r.status<>'DRAFT' then raise exception '路線已變更或已發布，請重新載入' using errcode='40001'; end if;
 elsif p_expected<>0 then raise exception '路線不存在' using errcode='40001'; end if;
 if p_name is null or length(trim(p_name)) not between 1 and 120 or p_start is null or p_end is null or p_end<=p_start or p_end-p_start>interval '16 hours' then raise exception '路線名稱或時間範圍無效'; end if;
 if not exists(select 1 from public.yj_memberships where org_id=p_org and user_id=p_driver and active and role in ('ENGINEER','DRIVER')) then raise exception '請選擇已登入的有效收送人員或工程師'; end if;
 if p_stops is null or jsonb_typeof(p_stops)<>'array' or jsonb_array_length(p_stops) not between 1 and 30 then raise exception '每條路線須有 1 至 30 個站點'; end if;
 v_revision:=coalesce(r.revision,0)+1;
 insert into public.yj_routes(id,org_id,revision,name,driver_id,starts_at,ends_at,created_by) values(v_id,p_org,v_revision,trim(p_name),p_driver,p_start,p_end,auth.uid())
 on conflict(id) do update set revision=v_revision,name=excluded.name,driver_id=excluded.driver_id,starts_at=excluded.starts_at,ends_at=excluded.ends_at;
 delete from public.yj_route_stops where route_id=v_id;
 for s in select value from jsonb_array_elements(p_stops) loop
 v_position:=v_position+1; v_start:=(s->>'starts_at')::timestamptz; v_end:=(s->>'ends_at')::timestamptz;
 if v_start is null or v_end is null or v_start<v_last or v_end<=v_start or v_end>p_end then raise exception '站點時間須依序、不重疊，且落在路線時段內'; end if;
 if not exists(select 1 from public.yj_cases where id=(s->>'case_id')::uuid and org_id=p_org and service='PICKUP' and workflow not in ('DONE','CANCELLED')) then raise exception '站點須使用同公司尚未結案的收送案件'; end if;
 insert into public.yj_route_stops(route_id,case_id,position,leg,address,starts_at,ends_at) values(v_id,(s->>'case_id')::uuid,v_position,s->>'leg',trim(s->>'address'),v_start,v_end);
 v_last:=v_end;
 end loop;
 perform yj_private.audit(p_org,'ROUTE_DRAFT_SAVED',v_id,jsonb_build_object('revision',v_revision,'stops',v_position));
 return jsonb_build_object('id',v_id,'revision',v_revision);
end;
$$;

create function public.yj_publish_route(p_route uuid,p_expected integer) returns void language plpgsql security definer set search_path='' as $$
declare r public.yj_routes; v_org uuid;
begin
 select org_id into v_org from public.yj_routes where id=p_route;
 perform 1 from public.yj_organizations where id=v_org for update;
 perform yj_private.require_role(v_org,array['MANAGER']);
 select * into r from public.yj_routes where id=p_route for update;
 if p_expected is null or r.revision<>p_expected or r.status<>'DRAFT' then raise exception '路線已變更，請重新載入' using errcode='40001'; end if;
 if not exists(select 1 from public.yj_memberships where org_id=r.org_id and user_id=r.driver_id and active and role in ('ENGINEER','DRIVER')) then raise exception '收送人員已停用或角色已變更'; end if;
 if exists(select 1 from public.yj_routes where org_id=r.org_id and id<>r.id and driver_id=r.driver_id and status in ('PUBLISHED','DONE') and starts_at<r.ends_at and ends_at>r.starts_at) then raise exception '該人員已有重疊排線'; end if;
 if not exists(select 1 from public.yj_route_stops where route_id=r.id) then raise exception '路線沒有站點'; end if;
 if exists(select 1 from public.yj_route_stops s join public.yj_cases c on c.id=s.case_id where s.route_id=r.id and (c.workflow<>'APPROVED' or c.approved_revision is distinct from c.revision)) then raise exception '所有案件須經主管核准最新報價'; end if;
 if exists(select 1 from public.yj_route_stops s join public.yj_route_stops x on x.case_id=s.case_id and x.leg=s.leg and x.route_id<>s.route_id join public.yj_routes t on t.id=x.route_id where s.route_id=r.id and x.status<>'FAILED' and t.status in ('PUBLISHED','DONE')) then raise exception '同一案件的同一取送任務已排入其他路線'; end if;
 if exists(select 1 from public.yj_route_stops s where s.route_id=r.id and s.leg='RETURN' and not exists(
 select 1 from public.yj_route_stops x join public.yj_routes t on t.id=x.route_id where x.case_id=s.case_id and x.leg='PICKUP' and x.status<>'FAILED' and x.ends_at<=s.starts_at and (x.route_id=r.id or t.status in ('PUBLISHED','DONE')))) then raise exception '回送前必須先有較早的取件安排'; end if;
 update public.yj_routes set status='PUBLISHED',revision=revision+1 where id=r.id;
 perform yj_private.audit(r.org_id,'ROUTE_PUBLISHED',r.id,jsonb_build_object('revision',r.revision+1));
end;
$$;
create function public.yj_cancel_route(p_route uuid,p_expected integer,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare r public.yj_routes;
begin
 select org_id into r.org_id from public.yj_routes where id=p_route;
 perform 1 from public.yj_organizations where id=r.org_id for update;
 select * into r from public.yj_routes where id=p_route for update;
 perform yj_private.require_role(r.org_id,array['MANAGER']);
 if p_expected is null or r.revision<>p_expected or r.status not in ('DRAFT','PUBLISHED') then raise exception '路線已變更或已結束' using errcode='40001'; end if;
 if length(trim(coalesce(p_reason,''))) not between 1 and 500 then raise exception '請記錄取消原因'; end if;
 if exists(select 1 from public.yj_route_stops where route_id=r.id and status='DONE') then raise exception '已有完成站點，請完成剩餘站點或回報無法完成，保留執行紀錄'; end if;
 update public.yj_routes set status='CANCELLED',revision=revision+1 where id=r.id;
 perform yj_private.audit(r.org_id,'ROUTE_CANCELLED',r.id,jsonb_build_object('reason',p_reason));
end;
$$;
create function public.yj_update_stop(p_stop uuid,p_route_revision integer,p_status text,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare s public.yj_route_stops; r public.yj_routes; v_org uuid;
begin
 select t.org_id into v_org from public.yj_route_stops x join public.yj_routes t on t.id=x.route_id where x.id=p_stop;
 perform 1 from public.yj_organizations where id=v_org for update;
 select t.* into r from public.yj_route_stops x join public.yj_routes t on t.id=x.route_id where x.id=p_stop for update of t;
 select * into s from public.yj_route_stops where id=p_stop for update;
 perform yj_private.require_role(r.org_id,array['MANAGER','ENGINEER','DRIVER']);
 if yj_private.actor_role(r.org_id)<>'MANAGER' and r.driver_id<>auth.uid() then raise exception '不能回報其他人的路線' using errcode='42501'; end if;
 if p_route_revision is null or r.status<>'PUBLISHED' or r.revision<>p_route_revision or s.status<>'PENDING' then raise exception '任務已變更或已回報，請重新整理' using errcode='40001'; end if;
 if p_status is null or p_status not in ('DONE','FAILED') or p_note is null or length(p_note)>1000 or (p_status='FAILED' and length(trim(p_note))=0) then raise exception '請選擇完成或無法完成；無法完成須記錄原因'; end if;
 if not exists(select 1 from public.yj_cases where id=s.case_id and workflow='APPROVED' and approved_revision=revision) then raise exception '案件內容已變更或取消，請主管重新核准'; end if;
 if exists(select 1 from public.yj_route_stops where route_id=r.id and position<s.position and status='PENDING') then raise exception '請依站點順序回報'; end if;
 if p_status='DONE' and s.leg='RETURN' and not exists(select 1 from public.yj_route_stops x join public.yj_routes t on t.id=x.route_id where x.case_id=s.case_id and x.leg='PICKUP' and x.status='DONE' and t.status<>'CANCELLED') then raise exception '取件尚未完成，不能回報送回完成'; end if;
 update public.yj_route_stops set status=p_status,completion_note=p_note,completed_at=now() where id=s.id;
 update public.yj_routes set revision=revision+1,status=case when not exists(select 1 from public.yj_route_stops where route_id=r.id and status='PENDING') then 'DONE' else status end where id=r.id;
 perform yj_private.audit(r.org_id,'STOP_REPORTED',s.id,jsonb_build_object('status',p_status));
end;
$$;

create function public.yj_close_case(p_case uuid,p_expected integer,p_status text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare c public.yj_cases;
begin
 select org_id into c.org_id from public.yj_cases where id=p_case;
 perform 1 from public.yj_organizations where id=c.org_id for update;
 select org_id into c.org_id from public.yj_cases where id=p_case;
 perform 1 from public.yj_organizations where id=c.org_id for update;
 select * into c from public.yj_cases where id=p_case for update;
 perform yj_private.require_role(c.org_id,array['MANAGER']);
 if p_expected is null or c.revision<>p_expected or c.workflow in ('DONE','CANCELLED') then raise exception '案件已變更或已結案' using errcode='40001'; end if;
 if p_status is null or p_status not in ('DONE','CANCELLED') or length(trim(coalesce(p_reason,''))) not between 1 and 500 then raise exception '請填寫結案或取消原因'; end if;
 if exists(select 1 from public.yj_route_stops s join public.yj_routes r on r.id=s.route_id where s.case_id=c.id and r.status in ('DRAFT','PUBLISHED')) then raise exception '請先處理尚未結束的排線'; end if;
 if p_status='DONE' and (c.approved_revision is distinct from c.revision or c.workflow<>'APPROVED') then raise exception '須先核准最新報價才能結案'; end if;
 update public.yj_cases set workflow=p_status,updated_at=now() where id=c.id;
 perform yj_private.audit(c.org_id,'CASE_CLOSED',c.id,jsonb_build_object('status',p_status,'reason',p_reason));
end;
$$;

revoke all on all functions in schema yj_private from public,anon,authenticated;
grant execute on function yj_private.actor_role(uuid),yj_private.can_read_case(uuid),yj_private.can_read_route(uuid) to authenticated;
revoke all on function public.yj_join_workspaces(),public.yj_directory(uuid),public.yj_set_employee(uuid,text,text,text,boolean),public.yj_save_case(uuid,uuid,integer,jsonb,jsonb),public.yj_approve_case(uuid,integer,text),public.yj_assign_case(uuid,integer,uuid),public.yj_save_route(uuid,uuid,integer,text,uuid,timestamptz,timestamptz,jsonb),public.yj_publish_route(uuid,integer),public.yj_cancel_route(uuid,integer,text),public.yj_update_stop(uuid,integer,text,text),public.yj_close_case(uuid,integer,text,text) from public,anon;
grant execute on function public.yj_join_workspaces(),public.yj_directory(uuid),public.yj_set_employee(uuid,text,text,text,boolean),public.yj_save_case(uuid,uuid,integer,jsonb,jsonb),public.yj_approve_case(uuid,integer,text),public.yj_assign_case(uuid,integer,uuid),public.yj_save_route(uuid,uuid,integer,text,uuid,timestamptz,timestamptz,jsonb),public.yj_publish_route(uuid,integer),public.yj_cancel_route(uuid,integer,text),public.yj_update_stop(uuid,integer,text,text),public.yj_close_case(uuid,integer,text,text) to authenticated;
commit;
