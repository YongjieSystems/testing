-- Additive maintenance integration; existing inspection prices and routes are retained.
create table yj_private.repair_pricebook (org_id uuid primary key references public.yj_organizations(id), catalogue jsonb not null);
create table public.yj_repair_jobs (
 case_id uuid primary key references public.yj_cases(id),org_id uuid not null references public.yj_organizations(id),
 number text not null,revision integer not null,source_revision integer not null,origin_direct boolean not null,
 workflow text not null default 'REVIEW' check(workflow in ('REVIEW','APPROVED')),
 approved_revision integer,approved_by uuid references auth.users(id),approved_at timestamptz,
 approval_reason text,customer_consent text,updated_at timestamptz not null default now(),unique(org_id,number)
);
create table public.yj_repair_versions (
 case_id uuid not null references public.yj_repair_jobs(case_id),revision integer not null,snapshot jsonb not null,
 fingerprint text not null,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),primary key(case_id,revision)
);
create index on public.yj_repair_jobs(org_id,updated_at desc);
alter table public.yj_repair_jobs enable row level security;
alter table public.yj_repair_versions enable row level security;
revoke all on yj_private.repair_pricebook from public,anon,authenticated;
revoke all on public.yj_repair_jobs,public.yj_repair_versions from public,anon,authenticated;
grant select on public.yj_repair_jobs,public.yj_repair_versions to authenticated;
create policy repair_job_read on public.yj_repair_jobs for select to authenticated using(yj_private.actor_role(org_id) in ('MANAGER','STAFF') or (yj_private.actor_role(org_id)='ENGINEER' and yj_private.can_read_case(case_id)));
create policy repair_version_read on public.yj_repair_versions for select to authenticated using(exists(select 1 from public.yj_repair_jobs j where j.case_id=yj_repair_versions.case_id));

create function yj_private.repair_amount(n jsonb,k text,d numeric default 0) returns numeric language plpgsql immutable set search_path='' as $$
declare t text:=n->>k; v numeric;
begin
 if n ? k and n->k='null'::jsonb then raise exception '無效數字：%',k; end if;
 if t is null or t='' then return d; end if;
 if t !~ '^[0-9]{1,9}([.][0-9]{1,6})?$' then raise exception '無效數字：%',k; end if;
 v:=t::numeric;
 if v>100000000 or (k<>'finalEstimatedTime' and v<>round(v,2)) then raise exception '金額過大或小數超過兩位：%',k; end if;
 return v;
end;
$$;

create function yj_private.save_repair(p_org uuid,p_case uuid,p_expected integer,p_source_expected integer,p_draft jsonb,p_credit numeric,p_service text,p_window text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.yj_cases; j public.yj_repair_jobs; n jsonb:=p_draft->'note'; h jsonb:=p_draft->'handoverState';
 cat jsonb; v_model jsonb; issue jsonb; snap jsonb; source jsonb; v_id uuid:=coalesce(p_case,gen_random_uuid());
 v_direct boolean; v_rev integer; v_num text; v_fingerprint text; prev public.yj_repair_versions;
 parts_lo numeric;parts_hi numeric;extra numeric;hours numeric;rate numeric;labor numeric;shipping numeric;discount numeric;handover numeric:=0;
 calc_lo numeric;calc_hi numeric;lo numeric;hi numeric;inspection numeric:=0;transport numeric:=0;overlap numeric:=0;paid numeric:=0;total numeric;
begin
 perform 1 from public.yj_organizations where id=p_org for update;
 perform yj_private.require_role(p_org,array['MANAGER','STAFF']);
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
  insert into public.yj_cases(id,org_id,revision,customer,model,problem,service) values(v_id,p_org,1,coalesce(n->>'customerName',''),v_model->>'name',issue->>'name',p_service) returning * into c;
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

create function yj_private.approve_repair(p_case uuid,p_expected integer,p_source_expected integer,p_reason text,p_consent text) returns void language plpgsql security definer set search_path='' as $$
declare j public.yj_repair_jobs;c public.yj_cases;s jsonb;
begin
 select org_id into j.org_id from public.yj_repair_jobs where case_id=p_case;
 perform 1 from public.yj_organizations where id=j.org_id for update;
 perform yj_private.require_role(j.org_id,array['MANAGER']);
 select * into j from public.yj_repair_jobs where case_id=p_case for update;
 select * into c from public.yj_cases where id=p_case for update;
 if p_expected is null or p_source_expected is null or j.revision<>p_expected or c.revision<>p_source_expected or j.source_revision<>c.revision or c.workflow in ('DONE','CANCELLED') or j.workflow<>'REVIEW' then raise exception '案件或檢測版本已變更，請重新載入' using errcode='PT409'; end if;
 if length(trim(coalesce(p_reason,''))) not between 1 and 500 or length(trim(coalesce(p_consent,''))) not between 1 and 500 then raise exception '請填主管核准理由及客戶同意方式／時間'; end if;
 select snapshot into s from public.yj_repair_versions where case_id=p_case and revision=j.revision;
 if s->>'repairMin'<>s->>'repairMax' then raise exception '正式核准前須確認單一維修金額，不能使用預估區間'; end if;
 if not j.origin_direct and (c.workflow<>'APPROVED' or c.approved_revision is distinct from c.revision) then raise exception '請先核准最新檢測報價'; end if;
 update public.yj_repair_jobs set workflow='APPROVED',approved_revision=revision,approved_by=auth.uid(),approved_at=now(),approval_reason=trim(p_reason),customer_consent=trim(p_consent) where case_id=p_case;
 if j.origin_direct then update public.yj_cases set workflow='APPROVED',approved_revision=revision,updated_at=now() where id=p_case; end if;
 perform yj_private.audit(j.org_id,'REPAIR_APPROVED',p_case,jsonb_build_object('revision',j.revision,'reason',p_reason,'consent',p_consent));
end;
$$;

create function yj_private.export_repair(p_case uuid,p_expected integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.yj_repair_jobs;c public.yj_cases;s jsonb;
begin
 select * into j from public.yj_repair_jobs where case_id=p_case;
 perform 1 from public.yj_organizations where id=j.org_id for share;
 perform yj_private.require_role(j.org_id,array['MANAGER','STAFF']);
 select * into j from public.yj_repair_jobs where case_id=p_case;
 select * into c from public.yj_cases where id=p_case;
 if p_expected is null or j.revision<>p_expected or j.approved_revision is distinct from j.revision or j.workflow<>'APPROVED' or j.source_revision<>c.revision or c.workflow<>'APPROVED' or c.approved_revision is distinct from c.revision then raise exception '最新檢測與維修報價尚未完成核准，不能輸出正式報價' using errcode='PT409'; end if;
 select snapshot into s from public.yj_repair_versions where case_id=p_case and revision=j.revision;
 return s||jsonb_build_object('approvedAt',j.approved_at,'approvalReason',j.approval_reason,'customerConsent',j.customer_consent);
end;
$$;

create function yj_private.guard_repair_return() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='yj_routes' then
 if new.status='PUBLISHED' then
  if exists(select 1 from public.yj_route_stops s join public.yj_repair_jobs j on j.case_id=s.case_id join public.yj_cases c on c.id=j.case_id where s.route_id=new.id and s.leg='RETURN' and (j.workflow<>'APPROVED' or j.approved_revision is distinct from j.revision or j.source_revision<>c.revision)) then raise exception '回送前須核准最新維修報價及客戶同意紀錄'; end if;
 end if;
 elsif tg_table_name='yj_route_stops' then
 if new.leg='RETURN' and new.status='DONE' then
  if exists(select 1 from public.yj_repair_jobs j join public.yj_cases c on c.id=j.case_id where j.case_id=new.case_id and (j.workflow<>'APPROVED' or j.approved_revision is distinct from j.revision or j.source_revision<>c.revision)) then raise exception '維修報價已變更，請主管重新核准後再回送'; end if;
 end if;
 elsif tg_table_name='yj_cases' then
 if new.workflow='DONE' then
  if exists(select 1 from public.yj_repair_jobs j where j.case_id=new.id and (j.workflow<>'APPROVED' or j.approved_revision is distinct from j.revision or j.source_revision<>new.revision)) then raise exception '請先完成最新維修報價核准'; end if;
 end if;
 end if;
 return new;
end;
$$;
create trigger repair_route_guard before update on public.yj_routes for each row execute function yj_private.guard_repair_return();
create trigger repair_stop_guard before update on public.yj_route_stops for each row execute function yj_private.guard_repair_return();
create trigger repair_close_guard before update on public.yj_cases for each row execute function yj_private.guard_repair_return();

create function public.yj_save_repair(p_org uuid,p_case uuid,p_expected integer,p_source_expected integer,p_draft jsonb,p_credit numeric,p_service text,p_window text) returns jsonb language sql security invoker set search_path='' as $$select yj_private.save_repair(p_org,p_case,p_expected,p_source_expected,p_draft,p_credit,p_service,p_window);$$;
create function public.yj_approve_repair(p_case uuid,p_expected integer,p_source_expected integer,p_reason text,p_consent text) returns void language sql security invoker set search_path='' as $$select yj_private.approve_repair(p_case,p_expected,p_source_expected,p_reason,p_consent);$$;
create function public.yj_export_repair(p_case uuid,p_expected integer) returns jsonb language sql security invoker set search_path='' as $$select yj_private.export_repair(p_case,p_expected);$$;
revoke all on function yj_private.repair_amount(jsonb,text,numeric),yj_private.save_repair(uuid,uuid,integer,integer,jsonb,numeric,text,text),yj_private.approve_repair(uuid,integer,integer,text,text),yj_private.export_repair(uuid,integer),yj_private.guard_repair_return(),public.yj_save_repair(uuid,uuid,integer,integer,jsonb,numeric,text,text),public.yj_approve_repair(uuid,integer,integer,text,text),public.yj_export_repair(uuid,integer) from public,anon,authenticated;
grant execute on function yj_private.save_repair(uuid,uuid,integer,integer,jsonb,numeric,text,text),yj_private.approve_repair(uuid,integer,integer,text,text),yj_private.export_repair(uuid,integer),public.yj_save_repair(uuid,uuid,integer,integer,jsonb,numeric,text,text),public.yj_approve_repair(uuid,integer,integer,text,text),public.yj_export_repair(uuid,integer) to authenticated;

