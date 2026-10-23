-- Independent quotations; old snapshots and approvals remain historical records.
begin;
alter table public.yj_cases add column record_kind text not null default 'INSPECTION' check(record_kind in ('INSPECTION','REPAIR','LEGACY_LINKED'));
update public.yj_cases c set record_kind=case when j.origin_direct then 'REPAIR' else 'LEGACY_LINKED' end from public.yj_repair_jobs j where j.case_id=c.id;
create index yj_cases_kind_updated on public.yj_cases(org_id,record_kind,updated_at desc);
create or replace function public.yj_save_case(p_org uuid,p_case uuid,p_expected integer,p_record jsonb,p_costs jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
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
 if v_old.revision<>p_expected then raise exception '資料已由其他人修改，請重新載入最新版本' using errcode='PT409'; end if;
 if v_old.id is not null and v_old.record_kind<>'INSPECTION' then raise exception '此單不是獨立檢測單，請另建檢測報價'; end if;
 if v_old.workflow in ('DONE','CANCELLED') then raise exception '已結案或取消，請另建新案件'; end if;
 elsif p_expected<>0 then raise exception '案件不存在，請重新整理' using errcode='PT409'; end if;
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
create or replace function public.yj_publish_route(p_route uuid,p_expected integer) returns void language plpgsql security definer set search_path='' as $$
declare r public.yj_routes; v_org uuid;
begin
 select org_id into v_org from public.yj_routes where id=p_route;
 perform 1 from public.yj_organizations where id=v_org for update;
 perform yj_private.require_role(v_org,array['MANAGER','STAFF']);
 select * into r from public.yj_routes where id=p_route for update;
 if p_expected is null or r.revision<>p_expected or r.status<>'DRAFT' then raise exception '路線已變更，請重新載入' using errcode='PT409'; end if;
 if not exists(select 1 from public.yj_memberships where org_id=r.org_id and user_id=r.driver_id and active and role in ('ENGINEER','DRIVER')) then raise exception '收送人員已停用或角色已變更'; end if;
 if exists(select 1 from public.yj_routes where org_id=r.org_id and id<>r.id and driver_id=r.driver_id and status in ('PUBLISHED','DONE') and starts_at<r.ends_at and ends_at>r.starts_at) then raise exception '該人員已有重疊排線'; end if;
 if not exists(select 1 from public.yj_route_stops where route_id=r.id) then raise exception '路線沒有站點'; end if;
 if exists(select 1 from public.yj_route_stops s join public.yj_cases c on c.id=s.case_id where s.route_id=r.id and c.workflow in ('DONE','CANCELLED')) then raise exception '路線包含已結案或取消的案件，請更新站點'; end if;
 if exists(select 1 from public.yj_route_stops s join public.yj_route_stops x on x.case_id=s.case_id and x.leg=s.leg and x.route_id<>s.route_id join public.yj_routes t on t.id=x.route_id where s.route_id=r.id and x.status<>'FAILED' and t.status in ('PUBLISHED','DONE')) then raise exception '同一案件的同一取送任務已排入其他路線'; end if;
 if exists(select 1 from public.yj_route_stops s where s.route_id=r.id and s.leg='RETURN' and not exists(
 select 1 from public.yj_route_stops x join public.yj_routes t on t.id=x.route_id where x.case_id=s.case_id and x.leg='PICKUP' and x.status<>'FAILED' and x.ends_at<=s.starts_at and (x.route_id=r.id or t.status in ('PUBLISHED','DONE')))) then raise exception '回送前必須先有較早的取件安排'; end if;
 if exists(select 1 from public.yj_route_stops st join public.yj_cases c on c.id=st.case_id join public.yj_quote_versions v on v.case_id=c.id and v.revision=c.revision where st.route_id=r.id and c.service='PICKUP' and (v.record->'state'->'feeConfirmed' is distinct from 'true'::jsonb or v.record->'state'->'windowConfirmed' is distinct from 'true'::jsonb)) then raise exception '請先確認收送費用與約定時段，再發布路線'; end if;
 update public.yj_routes set status='PUBLISHED',revision=revision+1 where id=r.id;
 perform yj_private.audit(r.org_id,'ROUTE_PUBLISHED',r.id,jsonb_build_object('revision',r.revision+1));
end;
$$;
create or replace function public.yj_cancel_route(p_route uuid,p_expected integer,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare r public.yj_routes;
begin
 select org_id into r.org_id from public.yj_routes where id=p_route;
 perform 1 from public.yj_organizations where id=r.org_id for update;
 select * into r from public.yj_routes where id=p_route for update;
 perform yj_private.require_role(r.org_id,array['MANAGER','STAFF']);
 if p_expected is null or r.revision<>p_expected or r.status not in ('DRAFT','PUBLISHED') then raise exception '路線已變更或已結束' using errcode='PT409'; end if;
 if length(trim(coalesce(p_reason,''))) not between 1 and 500 then raise exception '請記錄取消原因'; end if;
 if exists(select 1 from public.yj_route_stops where route_id=r.id and status='DONE') then raise exception '已有完成站點，請完成剩餘站點或回報無法完成，保留執行紀錄'; end if;
 update public.yj_routes set status='CANCELLED',revision=revision+1 where id=r.id;
 perform yj_private.audit(r.org_id,'ROUTE_CANCELLED',r.id,jsonb_build_object('reason',p_reason));
end;
$$;
create or replace function public.yj_close_case(p_case uuid,p_expected integer,p_status text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare c public.yj_cases;
begin
 select org_id into c.org_id from public.yj_cases where id=p_case;
 perform 1 from public.yj_organizations where id=c.org_id for update;
 select org_id into c.org_id from public.yj_cases where id=p_case;
 perform 1 from public.yj_organizations where id=c.org_id for update;
 select * into c from public.yj_cases where id=p_case for update;
 perform yj_private.require_role(c.org_id,array['MANAGER','STAFF']);
 if p_expected is null or c.revision<>p_expected or c.workflow in ('DONE','CANCELLED') then raise exception '案件已變更或已結案' using errcode='PT409'; end if;
 if p_status is null or p_status not in ('DONE','CANCELLED') or length(trim(coalesce(p_reason,''))) not between 1 and 500 then raise exception '請填寫結案或取消原因'; end if;
 if exists(select 1 from public.yj_route_stops s join public.yj_routes r on r.id=s.route_id where s.case_id=c.id and r.status in ('DRAFT','PUBLISHED')) then raise exception '請先處理尚未結束的排線'; end if;
 update public.yj_cases set workflow=p_status,updated_at=now() where id=c.id;
 perform yj_private.audit(c.org_id,'CASE_CLOSED',c.id,jsonb_build_object('status',p_status,'reason',p_reason));
end;
$$;
create or replace function public.yj_assign_case(p_case uuid,p_expected integer,p_engineer uuid) returns void language plpgsql security definer set search_path='' as $$
declare c public.yj_cases;
begin
 select org_id into c.org_id from public.yj_cases where id=p_case;
 perform 1 from public.yj_organizations where id=c.org_id for update;
 select * into c from public.yj_cases where id=p_case for update;
 perform yj_private.require_role(c.org_id,array['MANAGER','STAFF']);
 if p_expected is null or c.assignment_version<>p_expected then raise exception '分派已變更' using errcode='PT409'; end if;
 if p_engineer is not null and not exists(select 1 from public.yj_memberships where org_id=c.org_id and user_id=p_engineer and active and role='ENGINEER') then raise exception '請選擇有效工程師'; end if;
 update public.yj_cases set assigned_to=p_engineer,assignment_version=assignment_version+1,updated_at=now() where id=c.id;
 perform yj_private.audit(c.org_id,'CASE_ASSIGNED',c.id,jsonb_build_object('engineer',p_engineer));
end;
$$;
create or replace function public.yj_update_stop(p_stop uuid,p_route_revision integer,p_status text,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare s public.yj_route_stops; r public.yj_routes; v_org uuid;
begin
 select t.org_id into v_org from public.yj_route_stops x join public.yj_routes t on t.id=x.route_id where x.id=p_stop;
 perform 1 from public.yj_organizations where id=v_org for update;
 select t.* into r from public.yj_route_stops x join public.yj_routes t on t.id=x.route_id where x.id=p_stop for update of t;
 select * into s from public.yj_route_stops where id=p_stop for update;
 perform yj_private.require_role(r.org_id,array['MANAGER','STAFF','ENGINEER','DRIVER']);
 if yj_private.actor_role(r.org_id) not in ('MANAGER','STAFF') and r.driver_id<>auth.uid() then raise exception '不能回報其他人的路線' using errcode='42501'; end if;
 if p_route_revision is null or r.status<>'PUBLISHED' or r.revision<>p_route_revision or s.status<>'PENDING' then raise exception '任務已變更或已回報，請重新整理' using errcode='PT409'; end if;
 if p_status is null or p_status not in ('DONE','FAILED') or p_note is null or length(p_note)>1000 or (p_status='FAILED' and length(trim(p_note))=0) then raise exception '請選擇完成或無法完成；無法完成須記錄原因'; end if;
 if not exists(select 1 from public.yj_cases where id=s.case_id and workflow not in ('DONE','CANCELLED')) then raise exception '案件已結案或取消，請先確認交接狀態'; end if;
 if exists(select 1 from public.yj_route_stops where route_id=r.id and position<s.position and status='PENDING') then raise exception '請依站點順序回報'; end if;
 if p_status='DONE' and s.leg='RETURN' and not exists(select 1 from public.yj_route_stops x join public.yj_routes t on t.id=x.route_id where x.case_id=s.case_id and x.leg='PICKUP' and x.status='DONE' and t.status<>'CANCELLED') then raise exception '取件尚未完成，不能回報送回完成'; end if;
 update public.yj_route_stops set status=p_status,completion_note=p_note,completed_at=now() where id=s.id;
 update public.yj_routes set revision=revision+1,status=case when not exists(select 1 from public.yj_route_stops where route_id=r.id and status='PENDING') then 'DONE' else status end where id=r.id;
 perform yj_private.audit(r.org_id,'STOP_REPORTED',s.id,jsonb_build_object('status',p_status));
end;
$$;
create or replace function yj_private.save_repair(p_org uuid,p_case uuid,p_expected integer,p_source_expected integer,p_draft jsonb,p_credit numeric,p_service text,p_window text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.yj_cases; j public.yj_repair_jobs; n jsonb:=p_draft->'note'; h jsonb:=p_draft->'handoverState';
 cat jsonb; v_model jsonb; issue jsonb; snap jsonb; source jsonb; v_id uuid:=coalesce(p_case,gen_random_uuid());
 v_direct boolean; v_rev integer; v_num text; v_fingerprint text; prev public.yj_repair_versions;
 parts_lo numeric;parts_hi numeric;extra numeric;hours numeric;rate numeric;labor numeric;shipping numeric;discount numeric;handover numeric:=0;
 calc_lo numeric;calc_hi numeric;lo numeric;hi numeric;inspection numeric:=0;transport numeric:=0;overlap numeric:=0;paid numeric:=0;total numeric;
begin
 perform 1 from public.yj_organizations where id=p_org for update;
 perform yj_private.require_role(p_org,array['MANAGER','STAFF']);
 if p_credit is distinct from 0 then raise exception '檢測與維修獨立計費，不再使用跨單折抵'; end if;
 if p_expected is null or p_expected<0 or p_source_expected is null or p_source_expected<0 or p_credit is null or p_credit<0 or p_credit>100000000 or p_credit<>round(p_credit,2) then raise exception '版本或折抵金額無效'; end if;
 if p_draft is null or octet_length(p_draft::text)>50000 or jsonb_typeof(n) is distinct from 'object' or jsonb_typeof(h) is distinct from 'object' then raise exception '請先選設備及故障，完成報價'; end if;
 select value into cat from yj_private.repair_pricebook b cross join lateral jsonb_array_elements(b.catalogue) where b.org_id=p_org and value->>'id'=p_draft->>'categoryId';
 select value into v_model from jsonb_array_elements(cat->'models') where value->>'id'=p_draft->>'modelId';
 select value into issue from jsonb_array_elements(v_model->'issues') where value->>'id'=p_draft->>'issueId';
 if issue is null then raise exception '此項目未列入共用價目表，請主管確認；原收費未變更'; end if;
 select coalesce(jsonb_object_agg(key,value),'{}') into n from jsonb_each(n) where key=any(array['manualBasePartsCost','customPartsCost','customPartName','finalEstimatedTime','manualLaborRate','shippingCost','specialDiscount','manualTotalMin','manualTotalMax','adjustmentReason','customerName','quotationDepartment','quotationPersonnel','serialNumber','pageCount','technicianNotes','activeParts']);
 if length(coalesce(n->>'customerName',''))>500 or length(coalesce(n->>'technicianNotes',''))>4000 or length(coalesce(n->>'adjustmentReason',''))>500 or length(coalesce(n->>'serialNumber',''))>500 or length(coalesce(p_window,''))>500 then raise exception '文字欄位過長'; end if;
 if n->>'pageCount' is not null and n->>'pageCount'<>'' and n->>'pageCount'!~'^[0-9]{1,12}$' then raise exception '使用張數須為非負整數'; end if;
 if jsonb_typeof(n->'activeParts') is distinct from 'array' or jsonb_array_length(n->'activeParts')>50 then raise exception '零件項目無效'; end if;
 parts_lo:=yj_private.repair_amount(n,'manualBasePartsCost',greatest(0,(issue->>'estimatedCostMin')::numeric-(issue->>'estimatedTimeHours')::numeric*350));
 parts_hi:=yj_private.repair_amount(n,'manualBasePartsCost',greatest(0,(issue->>'estimatedCostMax')::numeric-(issue->>'estimatedTimeHours')::numeric*350));
 extra:=yj_private.repair_amount(n,'customPartsCost');hours:=yj_private.repair_amount(n,'finalEstimatedTime');rate:=yj_private.repair_amount(n,'manualLaborRate',350);labor:=round(hours*rate,2);
 if labor>100000000 then raise exception '工時計價過大'; end if;
 shipping:=yj_private.repair_amount(n,'shippingCost');discount:=yj_private.repair_amount(n,'specialDiscount');
 if cat->>'id'='new-used-equipment' and h->'pcDriver'='true'::jsonb then
  if h->>'pcCountType'='4-6' then handover:=500;
  elsif h->>'pcCountType'='7+' then handover:=yj_private.repair_amount(h,'pcManualPrice');
  elsif h->>'pcCountType' is distinct from '1-3' then raise exception '交機台數無效'; end if;
 end if;
 calc_lo:=round(parts_lo+extra+labor+shipping+handover-discount,2);calc_hi:=round(parts_hi+extra+labor+shipping+handover-discount,2);
 if calc_lo<0 then raise exception '折扣超過最低費用小計'; end if;
 lo:=yj_private.repair_amount(n,'manualTotalMin',calc_lo);hi:=yj_private.repair_amount(n,'manualTotalMax',case when coalesce(n->>'manualTotalMin','')<>'' then lo else calc_hi end);
 if coalesce(n->>'manualTotalMin','')='' and coalesce(n->>'manualTotalMax','')<>'' then raise exception '請先輸入總額下限'; end if;
 if hi<lo then raise exception '最高價不得低於最低價'; end if;
 if (lo<>calc_lo or hi<>calc_hi) and length(trim(coalesce(n->>'adjustmentReason','')))=0 then raise exception '請填寫報價調整原因'; end if;
 select * into c from public.yj_cases where id=v_id for update;
 if found then
  if c.record_kind<>'REPAIR' then raise exception '舊連結案件僅供歷史查閱，請另建獨立維修單'; end if;
  if c.org_id<>p_org then raise exception '沒有此案件權限' using errcode='42501'; end if;
  if c.revision<>p_source_expected then raise exception '檢測案件已更新，請重新載入' using errcode='PT409'; end if;
  if c.workflow in ('DONE','CANCELLED') or exists(select 1 from public.yj_route_stops s where s.case_id=c.id and s.leg='RETURN' and s.status='DONE') then raise exception '已結案或回送，請另建案件'; end if;
  select * into j from public.yj_repair_jobs where case_id=c.id for update;
  v_direct:=coalesce(j.origin_direct,false);
  if coalesce(j.revision,0)<>p_expected then raise exception '維修報價已更新，請載入最新版本' using errcode='PT409'; end if;
  select record into source from public.yj_quote_versions where case_id=c.id and revision=c.revision;
  if not v_direct then
   if coalesce(n->>'customerName','')<>c.customer then raise exception '客戶名稱與檢測案件不同，請先確認是否連錯案件或更新檢測資料'; end if;
   if source->'state'->>'billingStage'='REPAIR' then raise exception '此案件已在檢測程式改為維修報價，不能再疊加維修費；請另建案件或保留原流程'; end if;
   inspection:=coalesce((source->>'total')::numeric,0);paid:=yj_private.repair_amount(source->'state','paidAmount');
   if c.service='ON_SITE' then transport:=(source->'state'->'pricing'->'TRANSPORT'->(source->'state'->>'zone')->>'price')::numeric;
   elsif c.service='PICKUP' and source->'state'->'feeConfirmed'='true'::jsonb then transport:=yj_private.repair_amount(source->'state','logisticsFee'); end if;
  end if;
  if v_direct then
   update public.yj_cases set customer=coalesce(n->>'customerName',''),model=v_model->>'name',problem=issue->>'name',updated_at=now() where id=c.id returning * into c;
  end if;
 else
  if p_case is not null or p_expected<>0 or p_source_expected<>0 then raise exception '案件不存在' using errcode='PT409'; end if;
  if p_service is null or p_service not in ('IN_STORE','PICKUP') then raise exception '請選擇到店或收送'; end if;
  if p_service='PICKUP' and length(trim(coalesce(p_window,'')))=0 then raise exception '收送案件請填約定時段及範圍'; end if;
  v_direct:=true;
  insert into public.yj_cases(id,org_id,revision,customer,model,problem,service,record_kind) values(v_id,p_org,1,coalesce(n->>'customerName',''),v_model->>'name',issue->>'name',p_service,'REPAIR') returning * into c;
  insert into public.yj_quote_versions(case_id,revision,record,created_by) values(v_id,1,jsonb_build_object('total',0,'problem',issue->>'name','state',jsonb_build_object('schemaVersion',2,'repairOrigin',true,'billingStage','REPAIR','repairConfirmed',false,'repairFee',lo,'customerName',c.customer,'deviceModel',c.model,'service',p_service,'logisticsFee',shipping,'logisticsWindow',p_window,'feeConfirmed',true,'windowConfirmed',true)),auth.uid());
 end if;
 if p_credit>greatest(0,inspection-transport) then raise exception '檢測折抵不可超過檢測報價扣除收送費後的金額'; end if;
 -- An earlier onsite visit is not the same service as later collection/delivery.
 overlap:=case when c.service='PICKUP' then least(transport,shipping) else 0 end;
 p_draft:=jsonb_build_object('categoryId',cat->>'id','modelId',v_model->>'id','issueId',issue->>'id','note',n,'handoverState',h);
 v_fingerprint:=md5(jsonb_build_object('draft',p_draft,'credit',p_credit,'source',c.revision,'service',c.service,'window',p_window)::text);
 select * into prev from public.yj_repair_versions where case_id=v_id and revision=j.revision;
 if prev.fingerprint=v_fingerprint then return jsonb_build_object('case_id',v_id,'revision',j.revision,'snapshot',prev.snapshot); end if;
 v_rev:=coalesce(j.revision,0)+1;v_num:=coalesce(j.number,'R'||to_char(now() at time zone 'Asia/Taipei','YYMMDD')||upper(substr(replace(v_id::text,'-',''),1,8)));
 snap:=jsonb_build_object('orderId',v_num,'caseId',v_id,'revision',v_rev,'sourceRevision',c.revision,'draft',p_draft||jsonb_build_object('note',n),
  'customer',c.customer,'category',cat->>'name','model',v_model->>'name','issue',issue->>'name','partsMin',parts_lo,'partsMax',parts_hi,'extra',extra,'labor',labor,'shipping',shipping,'discount',discount,'handover',handover,
  'repairMin',lo,'repairMax',hi,'adjustmentMin',lo-calc_lo,'adjustmentMax',hi-calc_hi,'inspectionTotal',inspection,'inspectionCredit',p_credit,'transportOverlap',overlap,'paidReference',paid,
  'totalMin',inspection+lo-p_credit-overlap,'totalMax',inspection+hi-p_credit-overlap,'remainingMin',greatest(0,inspection+lo-p_credit-overlap-paid),'remainingMax',greatest(0,inspection+hi-p_credit-overlap-paid),
  'deliveryWindow',p_window,'createdAt',now());
 insert into public.yj_repair_jobs(case_id,org_id,number,revision,source_revision,origin_direct) values(v_id,p_org,v_num,v_rev,c.revision,v_direct)
 on conflict(case_id) do update set revision=v_rev,source_revision=c.revision,workflow='REVIEW',approved_revision=null,approved_by=null,approved_at=null,approval_reason=null,customer_consent=null,updated_at=now();
 insert into public.yj_repair_versions(case_id,revision,snapshot,fingerprint,created_by) values(v_id,v_rev,snap,v_fingerprint,auth.uid());
 perform yj_private.audit(p_org,'REPAIR_SAVED',v_id,jsonb_build_object('revision',v_rev,'sourceRevision',c.revision));
 return jsonb_build_object('case_id',v_id,'revision',v_rev,'snapshot',snap);
end;
$$;

create or replace function yj_private.guard_repair_return() returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- Schedule ordering, case state and permissions are enforced by the route RPCs.
 -- There is no supervisor approval prerequisite for independent repair quotations.
 return new;
end;$$;
create or replace function yj_private.export_repair(p_case uuid,p_expected integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.yj_repair_jobs;s jsonb;
begin
 select * into j from public.yj_repair_jobs where case_id=p_case;
 perform 1 from public.yj_organizations where id=j.org_id for share;
 perform yj_private.require_role(j.org_id,array['MANAGER','STAFF']);
 select * into j from public.yj_repair_jobs where case_id=p_case;
 if p_expected is null or j.revision<>p_expected then raise exception '同事已更新報價，請載入最新版本' using errcode='PT409'; end if;
 select snapshot into s from public.yj_repair_versions where case_id=p_case and revision=j.revision;
 return s||jsonb_build_object('savedAt',j.updated_at,'legacyLinked',not j.origin_direct);
end;$$;
create or replace function public.yj_export_inspection(p_case uuid,p_expected integer) returns jsonb language plpgsql security definer set search_path='' as $$
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
revoke all on function public.yj_export_inspection(uuid,integer) from public,anon;
grant execute on function public.yj_export_inspection(uuid,integer) to authenticated;
create or replace function yj_private.rental_snapshot(raw jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare q jsonb;inq jsonb:='{}';lines jsonb:='[]';l jsonb;clean jsonb;p jsonb;k text;v jsonb;d jsonb;
 qty numeric;periods numeric;price numeric;base numeric;usage numeric;pages numeric;amount numeric;eligible numeric;
 subtotal numeric:=0;discount_base numeric:=0;discount numeric:=0;discount_value numeric;tax numeric:=0;net numeric;deposit numeric;
 suggested numeric:=0;rows jsonb:='[]';checks jsonb:='[]';errs jsonb;pending integer:=0;ids text[]:='{}';start_date text;end_date text;
 text_keys text[]:=array['customer','contact','phone','staff','purpose','start','end','readyAt','address','access','software','network','delivery','urgency','notes','payment','validUntil','tax','depositMode','deposit','depositReason'];
 flag_keys text[]:=array['stockConfirmed','scopeConfirmed','periodsConfirmed','licenseConfirmed','transportConfirmed','reviewed'];
begin
 if raw is null or jsonb_typeof(raw) is distinct from 'object' or octet_length(raw::text)>300000 or raw->>'schema' is distinct from '1' or jsonb_typeof(raw->'inquiry') is distinct from 'object' or jsonb_typeof(raw->'lines') is distinct from 'array' or jsonb_array_length(raw->'lines')>100 or jsonb_typeof(raw->'discount') is distinct from 'object' then raise exception '報價資料格式錯誤或過大'; end if;
 if jsonb_typeof(raw->'id') is distinct from 'string' or length(raw->>'id') not between 1 and 80 then raise exception '報價識別碼無效';end if;
 foreach k in array text_keys loop
  v:=raw->'inquiry'->k;if jsonb_typeof(v) is distinct from 'string' or length(v#>>'{}')>5000 then raise exception '詢價文字欄位錯誤：%',k;end if;
  inq:=inq||jsonb_build_object(k,v);
 end loop;
 foreach k in array flag_keys loop
  v:=raw->'inquiry'->k;if jsonb_typeof(v) is distinct from 'boolean' then raise exception '確認欄位錯誤：%',k;end if;inq:=inq||jsonb_build_object(k,v);
 end loop;
 if inq->>'tax' not in ('pending','included','exclusive') or inq->>'depositMode' not in ('pending','collect','waive') or inq->>'delivery' not in ('待確認','客戶自取自還','專人送裝及回收','僅送達／回收另約','物流寄送來回','多地點／特殊交付') or inq->>'urgency' not in ('正常預約','優先整備','當日急件','夜間／假日','交期待確認') then raise exception '詢價選項無效';end if;
 for l in select value from jsonb_array_elements(raw->'lines') loop
  clean:='{}';errs:='[]';p:=null;base:=null;usage:=0;amount:=null;eligible:=0;
  if jsonb_typeof(l) is distinct from 'object' then raise exception '品項格式無效';end if;
  foreach k in array array['id','kind','planId','name','qty','periods','unit','price','pages','scope','override','overrideReason','start','end'] loop
   if jsonb_typeof(l->k) is distinct from 'string' or length(l->>k)>5000 then raise exception '品項文字欄位錯誤：%',k;end if;clean:=clean||jsonb_build_object(k,l->k);
  end loop;
  if jsonb_typeof(l->'discountable') is distinct from 'boolean' or l->>'kind' not in ('equipment','software','network','delivery','urgent','custom') or l->>'unit' not in ('天','月','次','小時','點','趟','人日') or length(l->>'id') not between 1 and 80 or l->>'id'=any(ids) then raise exception '品項類別或識別碼錯誤／重複';end if;
  ids:=array_append(ids,l->>'id');clean:=clean||jsonb_build_object('discountable',l->'discountable');
  qty:=yj_private.rental_number(l->>'qty',1000,true);periods:=yj_private.rental_number(l->>'periods',3650,true);pages:=yj_private.rental_number(l->>'pages',10000000,true);
  if qty is null or qty=0 then errs:=errs||'"數量須為1～1,000整數"'::jsonb;end if;
  if periods is null or periods=0 then errs:=errs||'"計費期數須為正整數"'::jsonb;end if;
  if length(trim(l->>'name'))=0 then errs:=errs||'"請填項目名稱"'::jsonb;end if;
  if l->>'planId'<>'' then
   select plan into p from yj_private.rental_catalogue where id=l->>'planId';
   if p is null or l->>'kind'<>'equipment' or p->>'unit'<>l->>'unit' then raise exception '原價設備方案不存在或計費單位被變更';end if;
   base:=case when p->'tier'='true'::jsonb then 850+(periods-1)*150 else (p->>'rate')::numeric*periods end;
   if p->'tier'='true'::jsonb and periods>15 then errs:=errs||'"筆電短租最多15天，請另選方案"'::jsonb;end if;
   if p ? 'usage' then
    if pages is null then errs:=errs||'"請填每台預估印量"'::jsonb;else usage:=greatest(0,pages-coalesce((p->>'included')::numeric,0))*(p->>'usage')::numeric;if l->>'planId' like 'ink-%' then usage:=floor(usage);end if;end if;
   end if;
  else
   price:=yj_private.rental_number(l->>'price',10000000);
   if price is null then errs:=errs||'"單價待估"'::jsonb;else base:=price*periods;end if;
  end if;
  if l->>'kind'='equipment' and ((l->>'unit'='月' and periods>36) or (l->>'unit'='天' and periods>1096)) then errs:=errs||'"設備租期不可超過3年"'::jsonb;end if;
  if trim(l->>'override')<>'' then base:=yj_private.rental_number(l->>'override',10000000);if length(trim(l->>'overrideReason'))=0 then errs:=errs||'"人工調價須填原因"'::jsonb;end if;end if;
  start_date:=coalesce(nullif(l->>'start',''),inq->>'start');end_date:=coalesce(nullif(l->>'end',''),inq->>'end');
  if ((l->>'start'<>'' and not yj_private.rental_date(l->>'start')) or (l->>'end'<>'' and not yj_private.rental_date(l->>'end'))) then errs:=errs||'"品項日期無效"'::jsonb;end if;
  if yj_private.rental_date(start_date) and yj_private.rental_date(end_date) and (end_date::date<start_date::date or end_date::date>(start_date::date+interval '3 years')::date) then errs:=errs||'"品項期間須在1天至3年內"'::jsonb;end if;
  if jsonb_array_length(errs)=0 and base is not null and qty is not null then amount:=round((round(base,2)+round(usage,2))*qty,2);if amount>1000000000 then raise exception '單項金額過大';end if;end if;
  if amount is null then pending:=pending+1;else subtotal:=subtotal+amount;if l->'discountable'='true'::jsonb and l->>'kind'='equipment' and l->>'planId'<>'laser-cm' then eligible:=round(base,2)*qty;discount_base:=discount_base+eligible;end if;end if;
  suggested:=suggested+coalesce((p->>'deposit')::numeric*qty,0);
  rows:=rows||jsonb_build_array(jsonb_build_object('amount',amount,'base',base,'usage',usage,'errors',errs,'deposit',coalesce((p->>'deposit')::numeric*qty,0),'discountBase',eligible));lines:=lines||jsonb_build_array(clean);
 end loop;
 d:=raw->'discount';if d->>'type' is null or d->>'type' not in ('amount','percent') or jsonb_typeof(d->'value') is distinct from 'string' or jsonb_typeof(d->'reason') is distinct from 'string' or length(d->>'reason')>5000 then raise exception '優惠格式錯誤';end if;
 d:=jsonb_build_object('type',d->'type','value',d->'value','reason',d->'reason');discount_value:=yj_private.rental_number(d->>'value',case when d->>'type'='percent' then 100 else 100000000 end);
 if discount_value is null then checks:=checks||'"優惠金額待確認"'::jsonb;else discount:=case when d->>'type'='percent' then round(discount_base*discount_value/100,2) else discount_value end;end if;
 if discount>discount_base then checks:=checks||'"優惠不可超過勾選設備基本租金"'::jsonb;end if;
 if discount>0 and length(trim(d->>'reason'))=0 then checks:=checks||'"請填優惠原因"'::jsonb;end if;
 net:=round(subtotal-least(discount,discount_base),2);if inq->>'tax'='exclusive' then tax:=round(net*.05,2);end if;
 if inq->>'depositMode'='collect' then deposit:=yj_private.rental_number(inq->>'deposit',100000000);if deposit is null then checks:=checks||'"押金金額待確認"'::jsonb;end if;elsif inq->>'depositMode'='waive' then deposit:=0;end if;
 if deposit=0 and length(trim(inq->>'depositReason'))=0 then checks:=checks||'"免收或零元押金須填原因"'::jsonb;end if;
 if jsonb_array_length(lines)=0 then checks:=checks||'"尚未加入品項"'::jsonb;end if;if pending>0 then checks:=checks||'"有品項待估或輸入錯誤"'::jsonb;end if;
 if length(trim(inq->>'customer'))=0 then checks:=checks||'"客戶名稱未填"'::jsonb;end if;if length(trim(inq->>'staff'))=0 then checks:=checks||'"報價人員未填"'::jsonb;end if;
 if not yj_private.rental_date(inq->>'start') or not yj_private.rental_date(inq->>'end') then checks:=checks||'"請確認起租與歸還日期"'::jsonb;
 elsif (inq->>'end')::date<(inq->>'start')::date or (inq->>'end')::date>((inq->>'start')::date+interval '3 years')::date then checks:=checks||'"租期須在1天至3年內"'::jsonb;end if;
 if not yj_private.rental_date(inq->>'validUntil') then checks:=checks||'"報價有效期限待確認"'::jsonb;end if;
 if inq->>'tax'='pending' then checks:=checks||'"稅額方式待確認"'::jsonb;end if;if inq->>'depositMode'='pending' then checks:=checks||'"押金方式待確認"'::jsonb;end if;
 if length(trim(inq->>'payment'))=0 then checks:=checks||'"付款安排未填"'::jsonb;end if;
 if inq->>'delivery'='待確認' then checks:=checks||'"交付方式待確認"'::jsonb;end if;
 if inq->>'delivery'<>'客戶自取自還' and length(trim(inq->>'address'))=0 then checks:=checks||'"交付地點未填"'::jsonb;end if;
 if inq->>'delivery' not in ('待確認','客戶自取自還') and (inq->'transportConfirmed'<>'true'::jsonb or not exists(select 1 from jsonb_array_elements(lines) x where x->>'kind'='delivery')) then checks:=checks||'"送裝及回收費另計，請列品項並確認"'::jsonb;end if;
 if inq->>'urgency'='交期待確認' then checks:=checks||'"交期尚未確認"'::jsonb;
 elsif inq->>'urgency'<>'正常預約' and ((inq->>'readyAt') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$' or not exists(select 1 from jsonb_array_elements(lines) x where x->>'kind'='urgent')) then checks:=checks||'"請確認急件費及最晚完成時間"'::jsonb;end if;
 if exists(select 1 from jsonb_array_elements(lines) x where length(trim(x->>'scope'))=0) then checks:=checks||'"有品項服務範圍未填"'::jsonb;end if;

 if (length(trim(inq->>'software'))>0 or exists(select 1 from jsonb_array_elements(lines) x where x->>'kind'='software' or x->>'planId'='pc-office')) and inq->'licenseConfirmed'<>'true'::jsonb then checks:=checks||'"軟體授權與安裝方式未確認"'::jsonb;end if;
 q:=jsonb_build_object('schema',1,'id',raw->>'id','inquiry',inq,'lines',lines,'discount',d);
 return jsonb_build_object('quote',q,'priceVersion',1,'totals',jsonb_build_object('rows',rows,'subtotal',subtotal,'discountBase',discount_base,'discount',discount,'net',net,'tax',tax,'total',net+tax,'deposit',deposit,'suggestedDeposit',suggested,'checks',checks,'pending',pending,'ready',jsonb_array_length(checks)=0));
end;$$;
create or replace function yj_private.official_rental(p_id uuid,p_expected integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare h public.yj_rental_quotes;snap jsonb;name text;
begin
 select * into h from public.yj_rental_quotes where id=p_id;perform yj_private.require_role(h.org_id,array['MANAGER','STAFF']);
 if p_expected is null or h.revision<>p_expected then raise exception '報價已更新，請載入最新版本' using errcode='PT409';end if;
 select snapshot into snap from public.yj_rental_versions where quote_id=p_id and revision=h.revision;
 if (yj_private.rental_snapshot(snap->'quote')->'totals'->>'ready')::boolean is not true then raise exception '本單仍有費用或條件待確認，可先保存詢價，補齊後再交付確定報價'; end if;
 select actor_name into name from public.yj_rental_events where quote_id=p_id and event='APPROVED' and revision=h.revision order by id desc limit 1;
 return jsonb_build_object('head',to_jsonb(h),'snapshot',snap,'exportable',true);
end;$$;

-- Disable obsolete decision endpoints rather than manufacturing approval records.
create or replace function public.yj_approve_case(p_case uuid,p_expected integer,p_reason text) returns void language plpgsql security invoker set search_path='' as $$begin raise exception '已改為直接報價，無須主管核准，請重新整理頁面'; end;$$;
create or replace function public.yj_approve_repair(p_case uuid,p_expected integer,p_source_expected integer,p_reason text,p_consent text) returns void language plpgsql security invoker set search_path='' as $$begin raise exception '已改為獨立維修報價，無須主管核准'; end;$$;
create or replace function public.yj_decide_rental(p_id uuid,p_expected integer,p_state integer,p_decision text,p_reason text) returns jsonb language plpgsql security invoker set search_path='' as $$begin raise exception '已改為直接報價，無須主管核准'; end;$$;

create table public.yj_announcements (
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.yj_organizations(id),
 title text not null check(length(title) between 1 and 100),body text not null check(length(body) between 1 and 4000),
 revision integer not null default 1,active boolean not null default true,
 updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now()
);
alter table public.yj_announcements enable row level security;
revoke all on public.yj_announcements from public,anon,authenticated;
grant select on public.yj_announcements to authenticated;
create policy announcement_read on public.yj_announcements for select to authenticated using (
 yj_private.actor_role(org_id)='MANAGER' or (active and yj_private.actor_role(org_id) in ('STAFF','ENGINEER','DRIVER'))
);
create index announcement_org_updated on public.yj_announcements(org_id,updated_at desc);
create or replace function public.yj_save_announcement(p_org uuid,p_id uuid,p_expected integer,p_title text,p_body text,p_active boolean) returns jsonb language plpgsql security definer set search_path='' as $$
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
revoke all on function public.yj_save_announcement(uuid,uuid,integer,text,text,boolean) from public,anon;
grant execute on function public.yj_save_announcement(uuid,uuid,integer,text,text,boolean) to authenticated;
commit;
