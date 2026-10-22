import test from 'node:test';
import assert from 'node:assert/strict';
import {LOGIN_MODES} from './login-session.js';
import {createClient} from '@supabase/supabase-js';
import {createLoginSession,watchLoginSession} from './login-session.js';
const store=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),map};};
function fixture(){let time=1700000000000,n=0;const local=store(),tab=store();const make=(ownTab=tab,namespace='qa')=>createLoginSession({namespace,local,tab:ownTab,now:()=>time,uuid:()=>String(++n)});return {local,tab,make,advance:n=>time+=n};}

for(const [mode,hours] of [['DAY',24],['MONTH',720]]) test(`${mode}: close/reopen restores, refresh never extends fixed expiry`,()=>{
 const f=fixture(),a=f.make();a.begin(mode);a.storage.setItem(a.storageKey,'fake-first');
 f.advance(3600000);a.storage.setItem(a.storageKey,'fake-refreshed');
 const reopened=f.make(store());assert.equal(reopened.storage.getItem(reopened.storageKey),'fake-refreshed');
 let expired=0;reopened.subscribe(()=>expired++);f.advance((hours-1)*3600000);
 assert.equal(reopened.active(),false);assert.equal(expired,1);assert.equal(reopened.storage.getItem(reopened.storageKey),null);
 a.storage.setItem(a.storageKey,'late-response');assert.equal(f.local.getItem('qa:saved'),null);
});
test('shared computer survives refresh in same tab but does not open in another tab; no credentials go to local storage',()=>{
 const f=fixture(),a=f.make();a.begin('SESSION');a.storage.setItem(a.storageKey,'fake-session');
 assert.equal(f.make().storage.getItem(a.storageKey),'fake-session');
 assert.equal(f.make(store()).storage.getItem(a.storageKey),null);
 assert.equal(f.local.getItem('qa:saved'),null);
 assert.ok(![...f.local.map.values()].join('').includes('fake-session'));
});
test('logout removes remembered credentials; another tab and an in-flight refresh cannot restore them',()=>{
 const f=fixture(),a=f.make();a.begin('MONTH');a.storage.setItem(a.storageKey,'fake');const b=f.make(store());
 a.clear();assert.equal(b.active(),false);b.storage.setItem(b.storageKey,'late');
 assert.equal(f.make(store()).active(),false);
});
test('stale tab cannot overwrite or delete a newer login and apps remain isolated on the same origin',()=>{
 const f=fixture(),a=f.make();a.begin('DAY');a.storage.setItem(a.storageKey,'old-account');const b=f.make(store());
 b.begin('MONTH');b.storage.setItem(b.storageKey,'new-account');
 a.storage.setItem(a.storageKey,'stale-refresh');a.storage.removeItem(a.storageKey);
 assert.equal(f.make(store()).storage.getItem(b.storageKey),'new-account');
 const other=f.make(store(),'other-app');assert.equal(other.active(),false);other.clear();assert.equal(b.active(),true);
});
test('renewed password login starts a new deadline; malformed storage and backward clock fail closed',()=>{
 const f=fixture(),a=f.make();a.begin('DAY');a.storage.setItem(a.storageKey,'fake');f.advance(86400000);assert.equal(a.active(),false);
 a.begin('MONTH');a.storage.setItem(a.storageKey,'new');assert.equal(a.active(),true);
 f.advance(-1);assert.equal(a.active(),false);
 f.local.setItem('qa:saved',JSON.stringify({id:'x',value:'fake',mode:'FOREVER'}));assert.equal(f.make(store()).active(),false);
});
test('legacy per-tab login is migrated only to session mode, never silently remembered',()=>{
 const f=fixture(),a=f.make();f.tab.setItem('old','legacy-fake');a.migrateLegacy(f.tab,'old');
 assert.equal(a.storage.getItem(a.storageKey),'legacy-fake');assert.equal(f.tab.getItem('old'),null);
 assert.equal(f.local.getItem('qa:saved'),null);assert.equal(f.make(store()).active(),false);
});
test('expiry watcher clears access once and releases its event handlers',()=>{
 const f=fixture(),a=f.make();a.begin('DAY');a.storage.setItem(a.storageKey,'fake');let tick,cleared=0;const events=new Map();
 const target={setInterval:fn=>(tick=fn,1),clearInterval(){tick=null},addEventListener:(k,fn)=>events.set(k,fn),removeEventListener:k=>events.delete(k)};
 const stop=watchLoginSession(a,()=>cleared++,target);f.advance(86400000);tick();tick();assert.equal(cleared,1);stop();assert.equal(tick,null);assert.equal(events.size,0);
});
test('login chooser has the three supported durations and no unlimited option',()=>{
 assert.deepEqual(Object.keys(LOGIN_MODES),['DAY','MONTH','SESSION']);
});
test('actual Supabase client restores and signs out via the adapter without a real account',{timeout:10000},async()=>{
 const f=fixture(),lease=f.make();lease.begin('DAY');
 const user={id:'00000000-0000-0000-0000-000000000001',email:'qa@example.com',app_metadata:{},user_metadata:{},aud:'authenticated',created_at:new Date().toISOString()};
 const token=btoa(JSON.stringify({alg:'HS256'}))+'.'+btoa(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600}))+'.fake';
 const transport=async url=>new Response(JSON.stringify(String(url).includes('/logout')?{}:{access_token:token,refresh_token:'fake-refresh',expires_in:3600,token_type:'bearer',user}),{status:200,headers:{'content-type':'application/json'}});
 const client=createClient('https://qa.invalid','fake-public-key',{auth:{storage:lease.storage,storageKey:lease.storageKey,persistSession:true,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:transport}});
 assert.equal((await client.auth.signInWithPassword({email:user.email,password:'synthetic-only'})).error,null);
 assert.equal(lease.active(),true);
 const next=f.make(store());const reopened=createClient('https://qa.invalid','fake-public-key',{auth:{storage:next.storage,storageKey:next.storageKey,persistSession:true,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:transport}});
 assert.equal((await reopened.auth.getSession()).data.session.user.email,user.email);
 await reopened.auth.signOut({scope:'local'});assert.equal(lease.active(),false);
});
