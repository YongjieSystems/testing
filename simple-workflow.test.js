import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {CONFIG} from './pricing-config.js';
const db=new PGlite();const ids=Object.fromEntries(['org','other','manager','staff','engineer','driver','disabled','outsider'].map((s,i)=>[s,`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`]));
async function as(who,sql,args=[]){await db.exec('begin;set local role authenticated;');try{await db.query("select set_config('request.jwt.claim.sub',$1,true)",[ids[who]]);const r=await db.query(sql,args);await db.exec('commit');return r.rows}catch(e){await db.exec('rollback');throw e}}
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const draft={categoryId:'desktop',modelId:'generic-desktop',issueId:'issue_001',note:{customerName:'獨立測試',activeParts:[],manualBasePartsCost:'',customPartsCost:0,finalEstimatedTime:2,manualLaborRate:350,shippingCost:300,specialDiscount:0,manualTotalMin:'1000',manualTotalMax:'',adjustmentReason:'整包',pageCount:''},handoverState:{pcDriver:false}};
before(async()=>{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 await db.exec(await read('./supabase/migrations/202610180001_team_workspace.sql'));
 await db.exec(await read('./supabase/fixtures/repair_workspace.sql'));
 await db.exec(await read('./supabase/fixtures/rental_workspace.sql'));
 await db.exec(await read('./supabase/engineer_staff_access.sql'));
 await db.exec(await read('./supabase/simple_workflow.sql'));
 await db.exec(await read('./supabase/simple_workflow_hardening.sql'));
 await db.query('insert into public.yj_organizations(id,name,pricebook) values($1,$2,$3),($4,$5,$3)',[ids.org,'QA SIMPLE',CONFIG,ids.other,'OTHER']);
 await db.query('insert into yj_private.repair_pricebook values($1,$2)',[ids.org,JSON.parse(await read('./supabase/fixtures/repair-prices.json'))]);
 for(const [who,role] of [['manager','MANAGER'],['staff','STAFF'],['engineer','ENGINEER'],['driver','DRIVER'],['disabled','STAFF'],['outsider',null]]){await db.query('insert into auth.users values($1,$2,now())',[ids[who],who+'@example.com']);if(role)await db.query('insert into public.yj_memberships(org_id,user_id,email,display_name,role,active,staff_access) values($1,$2,$3,$4,$5,$6,$7)',[ids.org,ids[who],who+'@example.com',who,role,who!=='disabled',who==='engineer'])}
});
after(()=>db.close());
test('staff and enabled engineer save and export independent repair without supervisor, while money remains unchanged',async()=>{
 for(const who of ['staff','engineer']){
 const r=(await as(who,'select public.yj_save_repair($1,null,0,0,$2,0,$3,$4) r',[ids.org,draft,'PICKUP','下週取送']))[0].r;
 assert.equal(r.snapshot.totalMin,1000);assert.equal(r.snapshot.inspectionTotal,0);
 const out=(await as(who,'select public.yj_export_repair($1,1) r',[r.case_id]))[0].r;assert.equal(out.totalMin,1000);assert.equal(out.legacyLinked,false);assert.equal(out.approvedAt,undefined);
 assert.equal((await as(who,'select record_kind,approved_revision from public.yj_cases where id=$1',[r.case_id]))[0].record_kind,'REPAIR');
 await assert.rejects(as(who,'select public.yj_save_repair($1,$2,1,1,$3,1,$4,$5)',[ids.org,r.case_id,draft,'PICKUP','取送']),/獨立/);
 await assert.rejects(as(who,'select public.yj_export_repair($1,99)',[r.case_id]),{code:'PT409'});
 }
});
test('inspection is independent, staff can save/export and cannot reuse it as repair',async()=>{
 const state={schemaVersion:2,device:'DESKTOP',service:'IN_STORE',zone:'ZONE_A',urgency:'NORMAL',source:'OTHER',warranty:'OUT',billingStage:'DIAGNOSIS',customerName:'檢測獨立',paidAmount:0};
 const r=(await as('staff','select public.yj_save_case($1,null,0,$2,null) r',[ids.org,{state,problem:'無法開機'}]))[0].r;
 const record=(await as('engineer','select public.yj_export_inspection($1,1) r',[r.id]))[0].r;assert.equal(record.total,500);
 await assert.rejects(as('staff','select public.yj_save_repair($1,$2,0,1,$3,0,$4,$5)',[ids.org,r.id,draft,'IN_STORE','']),/獨立維修/);
 assert.equal((await as('staff','select approved_revision from public.yj_cases where id=$1',[r.id]))[0].approved_revision,null);
});
test('notice board is shared within team, manager publishes with history; employees cannot publish or read other team',async()=>{
 const a=(await as('manager','select public.yj_save_announcement($1,null,0,$2,$3,true) r',[ids.org,'本週提醒','請照原流程接單，不必等主管登入。']))[0].r;
 for(const who of ['staff','engineer','driver'])assert.equal((await as(who,'select * from public.yj_announcements')).length,1);
 for(const who of ['staff','engineer','driver','disabled','outsider'])await assert.rejects(as(who,'select public.yj_save_announcement($1,null,0,$2,$3,true)',[ids.org,'不允許','不允許']),{code:'42501'});
 assert.equal((await as('outsider','select * from public.yj_announcements')).length,0);
 await assert.rejects(as('manager','select public.yj_save_announcement($1,$2,0,$3,$4,true)',[ids.org,a.id,'舊版','舊版']),{code:'PT409'});
 await as('manager','select public.yj_save_announcement($1,$2,1,$3,$4,false)',[ids.org,a.id,'本週提醒','已下架']);
 assert.equal((await as('staff','select * from public.yj_announcements')).length,0);
 assert.equal((await as('manager',"select * from public.yj_audit_events where event='ANNOUNCEMENT_SAVED'")).length,2);
});
test('disabled, driver, outsider cannot create estimates; no cross-team access or management expansion',async()=>{
 for(const who of ['driver','disabled','outsider'])await assert.rejects(as(who,'select public.yj_save_repair($1,null,0,0,$2,0,$3,$4)',[ids.org,draft,'IN_STORE','']),{code:'42501'});
 await assert.rejects(as('engineer','select public.yj_save_repair($1,null,0,0,$2,0,$3,$4)',[ids.other,draft,'IN_STORE','']),{code:'42501'});
 await assert.rejects(as('staff',"select public.yj_set_employee($1,'no@example.com','No','MANAGER',true)",[ids.org]),{code:'42501'});
});
test('rental ready quote can export without approval or repetitive internal checkboxes; pending amounts remain blocked',async()=>{
 const q=JSON.parse(await read('./supabase/fixtures-rental-simple.json'));
 for(const who of ['staff','engineer']){
  q.id='QA-'+who;
  const saved=(await as(who,'select public.yj_save_rental($1,null,0,$2) r',[ids.org,q]))[0].r;
  const out=(await as(who,'select public.yj_official_rental($1,1) r',[saved.head.id]))[0].r;
  assert.equal(out.exportable,true);assert.equal(out.head.approved_by,null);assert.equal(out.snapshot.totals.total,600);
  await assert.rejects(as(who,'select public.yj_official_rental($1,99)',[saved.head.id]),{code:'PT409'});
 }
 const pending=structuredClone(q);pending.id='QA-pending';pending.inquiry.tax='pending';
 const saved=(await as('staff','select public.yj_save_rental($1,null,0,$2) r',[ids.org,pending]))[0].r;
 await assert.rejects(as('staff','select public.yj_official_rental($1,1)',[saved.head.id]),/待確認/);
});
test('staff can publish, execute and close an independent pickup repair without a manager; schedule order remains enforced',async()=>{
 const repair=(await as('staff','select public.yj_save_repair($1,null,0,0,$2,0,$3,$4) r',[ids.org,draft,'PICKUP','取送約定']))[0].r;
 const stops=[{case_id:repair.case_id,leg:'PICKUP',address:'QA address',starts_at:'2026-11-02T01:00:00Z',ends_at:'2026-11-02T01:20:00Z'},{case_id:repair.case_id,leg:'RETURN',address:'QA address',starts_at:'2026-11-02T02:00:00Z',ends_at:'2026-11-02T02:20:00Z'}];
 const route=(await as('staff','select public.yj_save_route($1,null,0,$2,$3,$4,$5,$6) r',[ids.org,'QA route',ids.engineer,'2026-11-02T01:00:00Z','2026-11-02T03:00:00Z',stops]))[0].r;
 await as('staff','select public.yj_publish_route($1,1)',[route.id]);
 const rows=await as('staff','select id,position from public.yj_route_stops where route_id=$1 order by position',[route.id]);
 await assert.rejects(as('engineer',"select public.yj_update_stop($1,2,'DONE','')",[rows[1].id]),/順序/);
 await as('engineer',"select public.yj_update_stop($1,2,'DONE','交接完成')",[rows[0].id]);
 await as('staff',"select public.yj_update_stop($1,3,'DONE','客戶已收件')",[rows[1].id]);
 await as('staff',"select public.yj_close_case($1,1,'DONE','工作完成')",[repair.case_id]);
 assert.equal((await as('staff','select workflow from public.yj_cases where id=$1',[repair.case_id]))[0].workflow,'DONE');
});
