import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the real auth coordinator with a fake Auth/DB transport. No production passwords.
function harness({role='STAFF',signedIn=false,setup=false,hash=''}={}) {
 const nodes=new Map(),contexts=[],sent=[],events={},timers=[];
 class Element {
  constructor(){this.hidden=false;this.value='';this.textContent='';this.children=[];this.dataset={};this.isConnected=true;this.disabled=false;this.handlers={};}
  append(...n){this.children.push(...n)} replaceChildren(...n){this.children=n} setAttribute(){} focus(){} addEventListener(n,fn){this.handlers[n]=fn}
 }
 const el=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id)};
 let active=true,fail=false,logged=signedIn;
 const u={id:'qa-user',email:'staff@example.com',user_metadata:{yj_password_setup:setup}};
 const auth={getUser:async()=>({data:{user:logged?u:null}}),onAuthStateChange:fn=>{events.auth=fn},signInWithPassword:async()=>{logged=true;return{data:{user:u}}},signOut:async()=>{logged=false;events.auth?.('SIGNED_OUT',null);return{}},resetPasswordForEmail:async(email,opt)=>{sent.push({email,opt});return{}},setSession:async()=>{logged=true;return{}},verifyOtp:async()=>{logged=true;return{}},updateUser:async()=>{u.user_metadata.yj_password_setup=false;return{}}};
 const client={auth,rpc:async()=>({data:[]}),from(table){let selfOnly=false;const q={select(){return q},eq(k){if(k==='user_id')selfOnly=true;return q},order(){return q},limit(){return q},in(){return q},then(resolve){return Promise.resolve(fail?{error:{message:'network failed'}}:{data:table==='yj_memberships'&&selfOnly&&active?[{org_id:'qa-org',display_name:'QA',role}]:[]}).then(resolve)}};return q}};
 const context={console,URLSearchParams,setTimeout,crypto,sessionStorage:{},TEAM_CONFIG:{enabled:true},TEAM_ROLES:{STAFF:'客服',MANAGER:'主管'},teamFetch(){},teamError:e=>e.message,localToIso:()=>'',isoToTaipeiInput:()=>'',teamPayload:()=>{},createClient:()=>client,setInterval:fn=>{timers.push(fn);return 1},clearInterval(){},location:{hash,pathname:'/',search:''},history:{replaceState(){context.location.hash=''}},window:{addEventListener(){},switchTab(){}},document:{getElementById:el,querySelectorAll:()=>[],addEventListener(){},createElement:()=>new Element(),hidden:false,activeElement:null}};
 const source=fs.readFileSync(new URL('./team-workspace.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export function initTeamWorkspace','function initTeamWorkspace');
 vm.runInNewContext(source+'\nthis.start=initTeamWorkspace',context);
 context.start({getRecord(){},onSaved(){},onOpenRecord(){},onContext:value=>contexts.push(value)});
 const flush=async()=>{for(let i=0;i<12;i++)await new Promise(setImmediate)};
 const click=async id=>{el(id).handlers.click();await flush()};
 return{el,contexts,sent,flush,click,timers,events,set active(v){active=v},set fail(v){fail=v},get hash(){return context.location.hash}};
}
test('logged-out initialization cannot grant quote access; valid active staff can login then logout revokes',async()=>{
 const h=harness();await h.flush();assert.equal(h.contexts.at(-1).role,null);
 h.el('team-email').value=' STAFF@EXAMPLE.COM ';await h.click('team-login-btn');assert.equal(h.contexts.at(-1).role,'STAFF');
 await h.click('team-signout');assert.equal(h.contexts.at(-1).user,null);
});
test('disabled membership and a failed membership refresh revoke existing access',async()=>{
 const h=harness({signedIn:true,role:'MANAGER'});await h.flush();assert.equal(h.contexts.at(-1).role,'MANAGER');
 h.active=false;await h.click('team-refresh');assert.equal(h.contexts.at(-1).role,null);
 h.active=true;await h.click('team-refresh');assert.equal(h.contexts.at(-1).role,'MANAGER');
 h.fail=true;await h.click('team-refresh');assert.equal(h.contexts.at(-1).role,null);
});
test('forgot password normalizes email and delivers recovery to the fixed production callback',async()=>{
 const h=harness();await h.flush();h.el('team-email').value=' YJ-SYSTEM@SERVICE5C.COM.TW ';await h.click('team-forgot-password');
 assert.equal(h.sent[0].email,'yj-system@service5c.com.tw');assert.equal(h.sent[0].opt.redirectTo,'https://yongjiesystems.github.io/testing/?reset=1');
 assert.equal(h.contexts.at(-1).user,null);
});
test('recovery and initial setup cannot unlock quote editor until personal password setup finishes',async()=>{
 const h=harness({signedIn:true,setup:true});await h.flush();assert.equal(h.contexts.at(-1).role,null);assert.equal(h.el('team-password-setup').hidden,false);
 h.el('team-new-password').value='fake-qa-password-only';h.el('team-confirm-password').value='fake-qa-password-only';await h.click('team-set-password');assert.equal(h.contexts.at(-1).role,'STAFF');
 const recovery=harness({hash:'#type=recovery&access_token=qa-token&refresh_token=qa-refresh'});await recovery.flush();assert.equal(recovery.hash,'');assert.equal(recovery.contexts.at(-1).role,null);
});
test('public query tabs remain open, quotation tab and customer export require employee access',()=>{
 const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8'), app=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');
 assert.match(html,/id="section-quote" class="hidden /);assert.match(app,/tabId==='quote' && !quoteAccess/);
 assert.match(app,/\['warranty','drivers','training'\]/);assert.match(app,/function addToHistory\(record\) \{\s*if\(!quoteAccess\)/);
});
