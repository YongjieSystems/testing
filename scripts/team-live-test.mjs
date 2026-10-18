import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { TEAM_CONFIG } from '../team-config.js';
const path=new URL('../.team-test.local',import.meta.url);
const setup=JSON.parse(await readFile(path,'utf8'));
const make=()=>createClient(TEAM_CONFIG.url,TEAM_CONFIG.publishableKey,{global:{fetch:(input,init={})=>fetch(input,{...init,signal:AbortSignal.timeout(20000)})},db:{retry:false},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const manager=make(), staff=make(),driver=make();
let passed=0;
const check=result=>{if(result.error)throw result.error;return result.data;};
const step=label=>console.log(JSON.stringify({stage:label,checksPassed:passed}));
async function activate(client,body,inviter) {
 const headers={'Content-Type':'application/json',apikey:TEAM_CONFIG.publishableKey};
 if(inviter) headers.Authorization='Bearer '+check(await inviter.auth.getSession()).session.access_token;
 const response=await fetch(TEAM_CONFIG.url+'/functions/v1/team-onboard',{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 const result=await response.json(); if(!response.ok)throw new Error(result.error || 'onboarding failed');
 const hash=new URLSearchParams(new URL(result.url).hash.slice(1)).get('team_token_hash');
 const verified=check(await client.auth.verifyOtp({token_hash:hash,type:'email'}));
 return verified.user.id;
}
try {
 setup.users=[await activate(manager,{mode:'bootstrap',token:setup.token})];
 const own=check(await manager.from('yj_memberships').select('org_id').eq('user_id',setup.users[0]).single());
 setup.org=own.org_id; await writeFile(path,JSON.stringify(setup));
 for(const [client,label,role] of [[staff,'staff','STAFF'],[driver,'driver','DRIVER']]) {
  const email=`yj-qa-${setup.nonce}-${label}@example.com`;
  check(await manager.rpc('yj_set_employee',{p_org:setup.org,p_email:email,p_name:'QA '+label,p_role:role,p_active:true}));
  setup.users.push(await activate(client,{mode:'invite',orgId:setup.org,email},manager)); await writeFile(path,JSON.stringify(setup));
 }
 passed++; step('authenticated'); // Three actual Auth sessions, not mocked role selectors.
 const state={schemaVersion:2,device:'DESKTOP',service:'PICKUP',zone:'ZONE_A',urgency:'NORMAL',source:'OTHER',warranty:'OUT',billingStage:'DIAGNOSIS',logisticsPlan:'DEDICATED',logisticsFee:300,feeConfirmed:true,windowConfirmed:true,logisticsWindow:'QA fixture only',customerName:'QA fixture, not a customer'};
 const saved=check(await staff.rpc('yj_save_case',{p_org:setup.org,p_case:null,p_expected:0,p_record:{state,problem:'QA TEMP',total:1},p_costs:null}));
 assert.equal(saved.record.total,800); passed++; step('saved');
 assert.equal(check(await manager.from('yj_cases').select('id').eq('id',saved.id)).length,1); passed++;
 assert.equal(check(await driver.from('yj_cases').select('id').eq('id',saved.id)).length,0); passed++;
 assert.equal((await staff.rpc('yj_approve_case',{p_case:saved.id,p_expected:1,p_reason:'unauthorized'})).error?.code,'42501'); passed++;
 const updated=check(await manager.rpc('yj_save_case',{p_org:setup.org,p_case:saved.id,p_expected:1,p_record:{state,problem:'QA updated'},p_costs:{hourlyCost:250,actualNotes:'private QA data'}}));
 assert.equal(updated.revision,2); step('manager-updated');
 assert.equal(check(await staff.from('yj_case_costs').select('*').eq('case_id',saved.id)).length,0); passed++;
 assert.equal((await staff.rpc('yj_save_case',{p_org:setup.org,p_case:saved.id,p_expected:1,p_record:{state,problem:'stale'},p_costs:null})).error?.code,'PT409'); passed++;
 check(await manager.rpc('yj_approve_case',{p_case:saved.id,p_expected:2,p_reason:'QA latest version approved'}));
 const routed=check(await staff.rpc('yj_save_route',{p_org:setup.org,p_route:null,p_expected:0,p_name:'QA TEMP route',p_driver:setup.users[2],p_start:'2026-10-20T01:00:00Z',p_end:'2026-10-20T03:00:00Z',p_stops:[
 {case_id:saved.id,leg:'PICKUP',address:'QA test only',starts_at:'2026-10-20T01:00:00Z',ends_at:'2026-10-20T01:20:00Z'},
 {case_id:saved.id,leg:'RETURN',address:'QA test only',starts_at:'2026-10-20T02:00:00Z',ends_at:'2026-10-20T02:20:00Z'}]}));
 assert.equal(check(await driver.from('yj_routes').select('id').eq('id',routed.id)).length,0); passed++;
 check(await manager.rpc('yj_publish_route',{p_route:routed.id,p_expected:1}));
 const tasks=check(await driver.from('yj_route_stops').select('*').eq('route_id',routed.id).order('position'));
 assert.equal(tasks.length,2); passed++;
 assert.equal(check(await driver.from('yj_quote_versions').select('*').eq('case_id',saved.id)).length,0); passed++;
 check(await driver.rpc('yj_update_stop',{p_stop:tasks[0].id,p_route_revision:2,p_status:'DONE',p_note:'QA pickup complete'}));
 assert.equal((await driver.rpc('yj_update_stop',{p_stop:tasks[1].id,p_route_revision:2,p_status:'DONE',p_note:'stale'})).error?.code,'PT409'); passed++;
 check(await driver.rpc('yj_update_stop',{p_stop:tasks[1].id,p_route_revision:3,p_status:'DONE',p_note:'QA return complete'}));
 assert.equal(check(await staff.from('yj_routes').select('status').eq('id',routed.id).single()).status,'DONE'); passed++;
 // Disabled staff retains a valid Auth token, but PostgreSQL immediately denies data and RPC access.
 check(await manager.rpc('yj_set_employee',{p_org:setup.org,p_email:`yj-qa-${setup.nonce}-staff@example.com`,p_name:'QA staff',p_role:'STAFF',p_active:false}));
 assert.equal(check(await staff.from('yj_cases').select('id')).length,0); passed++;
 console.log(JSON.stringify({liveChecksPassed:passed,orgId:setup.org,temporaryAccounts:setup.users.length}));
} catch(error) {console.error(JSON.stringify({failed:true,code:error.code,message:error.message}));process.exitCode=1;}
finally {await writeFile(path,JSON.stringify(setup)); for(const client of [manager,staff,driver]) {try{await client.auth.signOut({scope:'local'});}catch{}}}
