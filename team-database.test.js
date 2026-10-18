import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { CONFIG } from './pricing-config.js';
const db = new PGlite();
const ids = Object.fromEntries(['org','otherOrg','manager','staff','engineer','driver','outsider','otherManager','unverified'].map((key,index)=>[key,`00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`]));
let caseId, caseRevision, routeId, routeRevision;
async function as(user,sql,params=[]) {
  await db.exec('begin; set local role authenticated;');
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[ids[user] || user]);
    const result=await db.query(sql,params); await db.exec('commit'); return result.rows;
  } catch(error) { await db.exec('rollback'); throw error; }
}
async function save(changes={},expected=0,id=null,actor='staff',costs=null) {
  return (await as(actor,'select public.yj_save_case($1,$2,$3,$4,$5) result',[ids.org,id,expected,{state:{schemaVersion:2,device:'DESKTOP',zone:'ZONE_A',service:'PICKUP',urgency:'NORMAL',source:'OTHER',warranty:'OUT',billingStage:'DIAGNOSIS',logisticsPlan:'DEDICATED',logisticsFee:300,feeConfirmed:true,windowConfirmed:true,logisticsWindow:'約定取件與回送',...changes},problem:'test',total:1},costs]))[0].result;
}
before(async()=>{
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
  await db.exec(await readFile(new URL('./supabase/migrations/202610180001_team_workspace.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('./supabase/migrations/202610180002_account_onboarding.sql',import.meta.url),'utf8'));
  for (const name of ['202610180003_supporting_indexes.sql','202610180004_conflict_responses.sql']) await db.exec(await readFile(new URL('./supabase/migrations/'+name,import.meta.url),'utf8'));
  await db.query('insert into public.yj_organizations(id,name,pricebook) values($1,$2,$3),($4,$5,$3)',[ids.org,'Test',CONFIG,ids.otherOrg,'Other']);
  for(const name of ['manager','staff','engineer','driver','outsider','otherManager','unverified']) await db.query('insert into auth.users values($1,$2,$3)',[ids[name],`${name}@example.test`,name==='unverified'?null:new Date().toISOString()]);
  for(const [name,role,org] of [['manager','MANAGER',ids.org],['staff','STAFF',ids.org],['engineer','ENGINEER',ids.org],['driver','DRIVER',ids.org],['otherManager','MANAGER',ids.otherOrg]]) await db.query('insert into public.yj_memberships(org_id,user_id,email,display_name,role) values($1,$2,$3,$4,$5)',[org,ids[name],`${name.toLowerCase()}@example.test`,name,role]);
});
after(()=>db.close());

test('database: anonymous users cannot read or call write APIs',async()=>{
  await db.exec('set role anon');
  try {
    await assert.rejects(db.query('select * from public.yj_cases'),{code:'42501'});
    await assert.rejects(db.query('select public.yj_join_workspaces()'),{code:'42501'});
  } finally { await db.exec('reset role'); }
});
test('database: outside users cannot gain access by metadata or by calling RPCs directly',async()=>{
  assert.deepEqual(await as('outsider','select * from public.yj_cases'),[]);
  await assert.rejects(save({role:'MANAGER'},0,null,'outsider'),{code:'42501'});
  await assert.rejects(as('staff',"select public.yj_set_employee($1,'outsider@example.test','fake','MANAGER',true)",[ids.org]),{code:'42501'});
});
test('database: authoritative server prices ignore forged totals and pricebook snapshots',async()=>{
  const result=await save({pricing:{INSPECTION:{DESKTOP:{price:1}}},hourlyCost:999,role:'MANAGER'});
  caseId=result.id; caseRevision=result.revision;
  assert.equal(result.record.total,800); assert.equal(result.record.state.pricing.INSPECTION.DESKTOP.price,500);
  assert.equal(result.record.state.hourlyCost,undefined); assert.equal(result.record.state.role,undefined);
  await assert.rejects(save({logisticsFee:-1}),/金額/);
  await assert.rejects(save({specialDiscount:1000001}),/金額/);
});
test('database: stale writes are rejected atomically',async()=>{
  const result=await save({customerName:'new'},caseRevision,caseId); caseRevision=result.revision;
  await assert.rejects(save({customerName:'stale'},1,caseId),{code:'PT409'});
  assert.equal((await as('staff','select count(*)::int count from public.yj_quote_versions where case_id=$1',[caseId]))[0].count,2);
});
test('database: costs and audit data are restricted to supervisors; direct table writes are forbidden',async()=>{
  await assert.rejects(save({},caseRevision,caseId,'staff',{hourlyCost:250}),{code:'42501'});
  const result=await save({},caseRevision,caseId,'manager',{hourlyCost:250}); caseRevision=result.revision;
  assert.equal((await as('manager','select * from public.yj_case_costs')).length,1);
  assert.equal((await as('staff','select * from public.yj_case_costs')).length,0);
  assert.equal((await as('staff','select * from public.yj_audit_events')).length,0);
  await assert.rejects(as('staff',"update public.yj_cases set workflow='APPROVED' where id=$1",[caseId]),{code:'42501'});
  await assert.rejects(as('staff',"select public.yj_approve_case($1,$2,'try')",[caseId,caseRevision]),{code:'42501'});
});
test('database: cross-company identifiers do not bypass isolation',async()=>{
  assert.equal((await as('otherManager','select * from public.yj_cases')).length,0);
  await assert.rejects(save({},caseRevision,caseId,'otherManager'),{code:'42501'});
  await assert.rejects(as('otherManager',"select public.yj_approve_case($1,$2,'cross-company')",[caseId,caseRevision]),{code:'42501'});
});
test('database: supervisors must approve confirmed fees and scheduling, including zero-fee services',async()=>{
  const pending=await save({windowConfirmed:false});
  await assert.rejects(as('manager',"select public.yj_approve_case($1,1,'review')",[pending.id]),/尚未確認/);
  await assert.rejects(as('manager',"select public.yj_approve_case($1,null,'review')",[caseId]),{code:'PT409'});
  await as('manager',"select public.yj_approve_case($1,$2,'標準費用及完整收送範圍已核對')",[caseId,caseRevision]);
});
const stops=id=>[
  {case_id:id,leg:'PICKUP',address:'測試取件地址',starts_at:'2026-10-20T01:00:00Z',ends_at:'2026-10-20T01:20:00Z'},
  {case_id:id,leg:'RETURN',address:'測試回送地址',starts_at:'2026-10-20T02:00:00Z',ends_at:'2026-10-20T02:20:00Z'}
];
async function route(stopList,driver=ids.driver,start='2026-10-20T01:00:00Z',end='2026-10-20T03:00:00Z') {
  return (await as('staff',"select public.yj_save_route($1,null,0,'test route',$2,$3,$4,$5) result",[ids.org,driver,start,end,stopList]))[0].result;
}
test('database: draft planning validates ordering and stays invisible to drivers',async()=>{
  await assert.rejects(route([...stops(caseId)].reverse()),/站點時間/);
  const result=await route(stops(caseId)); routeId=result.id; routeRevision=result.revision;
  assert.equal((await as('driver','select * from public.yj_routes')).length,0);
  assert.equal((await as('driver','select * from public.yj_route_stops')).length,0);
  await assert.rejects(as('staff','select public.yj_publish_route($1,$2)',[routeId,routeRevision]),{code:'42501'});
  await as('manager','select public.yj_publish_route($1,$2)',[routeId,routeRevision]); routeRevision++;
  assert.equal((await as('driver','select * from public.yj_route_stops')).length,2);
  assert.equal((await as('driver','select * from public.yj_quote_versions')).length,0);
  assert.equal((await as('driver','select * from public.yj_cases')).length,1);
  assert.equal((await as('engineer','select * from public.yj_cases')).length,0);
});
test('database: overlapping driver routes and duplicate pickup/return assignments are rejected',async()=>{
  const other=await save(); await as('manager',"select public.yj_approve_case($1,1,'review')",[other.id]);
  const conflict=await route(stops(other.id));
  await assert.rejects(as('manager','select public.yj_publish_route($1,1)',[conflict.id]),/重疊排線/);
  const duplicate=await route(stops(caseId),ids.engineer);
  await assert.rejects(as('manager','select public.yj_publish_route($1,1)',[duplicate.id]),/已排入其他路線/);
});
test('database: a driver cannot complete another driver route or return before pickup',async()=>{
  const rows=await as('driver','select id,position from public.yj_route_stops where route_id=$1 order by position',[routeId]);
  await assert.rejects(as('engineer',"select public.yj_update_stop($1,$2,'DONE','')",[rows[0].id,routeRevision]),{code:'42501'});
  await assert.rejects(as('driver',"select public.yj_update_stop($1,$2,'DONE','')",[rows[1].id,routeRevision]),/站點順序/);
  await as('driver',"select public.yj_update_stop($1,$2,'DONE','已取件')",[rows[0].id,routeRevision]); routeRevision++;
  await assert.rejects(as('driver',"select public.yj_update_stop($1,$2,'DONE','')",[rows[1].id,routeRevision-1]),{code:'PT409'});
  await as('driver',"select public.yj_update_stop($1,$2,'DONE','已送回')",[rows[1].id,routeRevision]); routeRevision++;
  assert.equal((await as('driver','select status from public.yj_routes where id=$1',[routeId]))[0].status,'DONE');
});
test('database: the last active supervisor cannot be removed and unverified email cannot claim membership',async()=>{
  await assert.rejects(as('manager',"select public.yj_set_employee($1,'manager@example.test','manager','STAFF',true)",[ids.org]),/最後一位/);
  await as('manager',"select public.yj_set_employee($1,'unverified@example.test','pending','ENGINEER',true)",[ids.org]);
  await assert.rejects(as('unverified','select public.yj_join_workspaces()'),{code:'42501'});
});


test('database: public callers cannot consume owner setup challenges or bind arbitrary users',async()=>{
  await assert.rejects(as('manager',"select public.yj_consume_bootstrap('arbitrary-bootstrap-token-should-never-work-1234')"),{code:'42501'});
  await assert.rejects(as('staff','select public.yj_finish_onboarding($1,$2,$3,null)',[ids.org,'outsider@example.test',ids.outsider]),{code:'42501'});
});
