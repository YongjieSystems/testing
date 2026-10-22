import { createLoginSession, watchLoginSession, LOGIN_MODES } from './login-session.js?v=1.13.0';
import { createClient } from './vendor/supabase.js?v=1.4.1';
import { TEAM_CONFIG } from './team-config.js?v=1.13.0';
import { effectiveTeamRole, TEAM_ROLES, teamPayload, teamError, localToIso, isoToTaipeiInput, teamFetch } from './team-core.js?v=1.13.0';

export function initTeamWorkspace({getRecord,onOpenRecord,onSaved,onContext=async()=>{}}) {
    const $=id=>document.getElementById(id);
    const status=text=>{ $('team-status').textContent=text; };
    const labels={REVIEW:'待主管核准',APPROVED:'已核准',DONE:'已完成',CANCELLED:'已取消',DRAFT:'草稿',PUBLISHED:'已發布',PENDING:'待處理',FAILED:'未完成'};
    const events={CASE_SAVED:'報價已同步',CASE_APPROVED:'主管已核准',CASE_ASSIGNED:'工程師已分派',ROUTE_DRAFT_SAVED:'排線草稿已保存',ROUTE_PUBLISHED:'排線已發布',ROUTE_CANCELLED:'排線已取消',STOP_REPORTED:'站點已回報',EMPLOYEE_CHANGED:'員工權限已調整',ACCOUNT_ACTIVATED:'帳號已開通',CASE_CLOSED:'案件已結束'};
    const loginSession=createLoginSession({namespace:'yj-inspection-login-v1',local:localStorage,tab:sessionStorage});
    loginSession.migrateLegacy(sessionStorage,'sb-buzcduwjeddaqwsrbwlf-auth-token');
    const client=TEAM_CONFIG.enabled ? createClient(TEAM_CONFIG.url,TEAM_CONFIG.publishableKey,{global:{fetch:teamFetch},db:{retry:false},auth:{persistSession:true,storage:loginSession.storage,storageKey:loginSession.storageKey,autoRefreshToken:true,detectSessionInUrl:false}}) : null;
    let contextGeneration=0;
    let recovery=false;
    for(const [value,label] of Object.entries(LOGIN_MODES)) { const option=document.createElement('option'); option.value=value; option.textContent=label; $('team-login-mode').append(option); }
    $('team-login-mode').value=loginSession.preference();
    let org=null,role=null,user=null,cases=[],routes=[],stops=[],directory=[],members=[],selectedCase=null,routeDraft=null,busy=false;
    const check=result=>{ if(result.error) throw result.error; return result.data; };
    const rpc=async(name,args={})=>check(await client.rpc(name,args));
    const manager=()=>role==='MANAGER';
    const operator=()=>['MANAGER','STAFF'].includes(role);
    function action(button,fn) { button.addEventListener('click',()=>run(fn)); }
    async function run(fn) {
        if(busy) return; busy=true;
        const disabledBefore = new Map([...document.querySelectorAll('#section-team button')].map(button=>[button,button.disabled]));
        for(const button of disabledBefore.keys()) button.disabled=true;
        status('正在處理，請稍候…');
        try { await fn(); } catch(error) { status(teamError(error)); }
        finally { if($('team-status').textContent==='正在處理，請稍候…') status('操作已完成。'); busy=false; for(const [button,wasDisabled] of disabledBefore) if(button.isConnected) button.disabled=wasDisabled; }
    }
    function node(tag,text,className='') { const element=document.createElement(tag); if(text!==undefined) element.textContent=String(text); element.className=className; return element; }
    function button(parent,label,fn) { const element=node('button',label,'p-2 rounded-lg bg-blue-100 text-blue-900 text-sm font-bold'); element.type='button'; action(element,fn); parent.append(element); return element; }
    function options(select,items,placeholder) {
        const previous=select.value; select.replaceChildren();
        if(placeholder) { const option=node('option',placeholder); option.value=''; select.append(option); }
        for(const item of items) { const option=node('option',item.label); option.value=item.value; select.append(option); }
        if(items.some(item=>item.value===previous)) select.value=previous;
    }
    function clear() {
        contextGeneration++;
        onContext({client,user:null,org:null,role:null,cases:[],routes:[],stops:[]});
        role=null; org=null; cases=[]; routes=[]; stops=[]; directory=[]; members=[]; selectedCase=null; routeDraft=null;
        for(const id of ['team-case-list','team-route-list','team-employee-list','team-audit-list','team-stop-editor']) $(id).replaceChildren();
        $('team-private').hidden=true; $('team-manager').hidden=true; $('team-operator').hidden=true;
        $('team-password-setup').hidden=true;
        for(const id of ['team-password','team-new-password','team-confirm-password']) if($(id)) $(id).value='';
        $('team-account-link').replaceChildren(); $('team-user').textContent='尚未登入'; $('team-login-retention').textContent='';
    }
    async function refreshContext() {
        if(!client) { status('團隊服務尚未設定。'); return; }
        const generation=++contextGeneration;
        loginSession.active();
        const verified=await client.auth.getUser();
        if(generation!==contextGeneration) return;
        if(verified.error || !verified.data.user) { clear(); user=null; $('team-login').hidden=false; status('請使用已開通的公司帳號登入。新帳號須由主管提供一次性設定連結。'); return; }
        user=verified.data.user;
        try { await rpc('yj_join_workspaces'); } catch(error) { clear(); throw error; }
        let own; try { own=check(await client.from('yj_memberships').select('org_id,role,display_name,staff_access').eq('user_id',user.id).eq('active',true)); } catch(error) { clear(); throw error; }
        if(generation!==contextGeneration) return;
        if(!own.length) { clear(); $('team-login').hidden=true; status('已登入，但尚未列入啟用員工名單。請主管登錄此電子郵件。'); return; }
        if(!own.some(item=>item.org_id===org)) org=own[0].org_id;
        const membership=own.find(item=>item.org_id===org);
        role=effectiveTeamRole(membership);
        options($('team-org'),own.map(item=>({value:item.org_id,label:item.display_name+' · '+TEAM_ROLES[item.role]}))); $('team-org').value=org;
        $('team-login-retention').textContent=loginSession.describe();
        $('team-user').textContent=`${user.email}｜${TEAM_ROLES[membership.role]}${membership.role!==role?'（助理同等作業權限）':''}`;
        $('team-login').hidden=true; $('team-private').hidden=false; $('team-manager').hidden=!manager(); $('team-operator').hidden=!operator();
        $('team-password-setup').hidden=!(recovery || user.user_metadata?.yj_password_setup===true);
        if(!$('team-password-setup').hidden) await onContext({client,user,org,role:null,cases:[],routes:[],stops:[]});
        if(!manager()) { $('team-account-link').replaceChildren(); $('team-audit-list').replaceChildren(); }
        const fetched=await Promise.all([
            client.from('yj_cases').select('*').eq('org_id',org).order('updated_at',{ascending:false}).limit(200),
            client.from('yj_routes').select('*').eq('org_id',org).order('starts_at',{ascending:false}).limit(100)
        ]);
        if(generation!==contextGeneration) return;
        cases=check(fetched[0]); routes=check(fetched[1]);
        // Fetch stops for the visible routes only; no company-wide private records reach engineers.
        stops=routes.length ? check(await client.from('yj_route_stops').select('*').in('route_id',routes.map(route=>route.id)).order('position')) : [];
        directory=operator() ? await rpc('yj_directory',{p_org:org}) : [];
        members=manager() ? check(await client.from('yj_memberships').select('*').eq('org_id',org).order('display_name')) : [];
        if(generation!==contextGeneration) return;
        renderCases(); renderRoutes(); renderEmployees();
        if(manager()) {
            const audit=check(await client.from('yj_audit_events').select('event,entity_id,created_at,actor_id,details').eq('org_id',org).order('created_at',{ascending:false}).limit(30));
            if(generation!==contextGeneration) return;
            $('team-audit-list').replaceChildren(...audit.map(item=>node('li',`${new Date(item.created_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})} · ${events[item.event] || item.event} · ${item.entity_id}${item.details?.reason ? ' · '+item.details.reason : ''}`,'text-xs break-all py-1')));
        }
        if(generation!==contextGeneration) return;
        await onContext({client,user,org,role:$('team-password-setup').hidden ? role : null,cases,routes,stops});
        status('已更新團隊資料。列表每 15 秒更新；編輯中的表單不會自動覆蓋，保存時會核對版本。');
    }
    async function refresh() { try { await refreshContext(); } catch(error) { clear(); throw error; } }
    function renderCases() {
        const list=$('team-case-list'); list.replaceChildren();
        if(!cases.length) list.append(node('p','目前沒有可讀取的案件。'));
        for(const item of cases) {
            const row=node('div',undefined,'p-4 border rounded-xl space-y-2');
            row.append(node('p',`${item.customer || '未填客戶'} · ${item.model || '未填型號'} · ${labels[item.workflow] || item.workflow}`,'font-bold'),node('p',item.id+` · 版本 ${item.revision}`,'text-xs break-all'),node('p',item.problem,'text-sm whitespace-pre-wrap break-words'));
            if(operator()) {
                let confirmLoad=false;
                const load=button(row,'載入至估價（會取代未存表單）',async()=>{
                    if(!confirmLoad) {confirmLoad=true; load.textContent='再次按下載入；請先保存目前表單'; return;}
                    const latest=check(await client.from('yj_cases').select('*').eq('id',item.id).single());
                    const snapshot=check(await client.from('yj_quote_versions').select('record').eq('case_id',item.id).eq('revision',latest.revision).single());
                    const costs=manager() ? check(await client.from('yj_case_costs').select('costs,quote_revision').eq('case_id',item.id).maybeSingle()) : null;
                    onOpenRecord(snapshot.record,{orgId:org,caseId:item.id,revision:latest.revision,costs:costs ? {...costs.costs,actualConfirmed:costs.quote_revision===latest.revision && costs.costs.actualConfirmed===true} : {}});
                    status(`已載入版本 ${latest.revision}${costs && costs.quote_revision!==latest.revision ? '；成本資料來自較早報價，請主管重新核對' : ''}`);
                });
                if(manager()) button(row,'選取供主管處理',async()=>{selectedCase=item; $('team-selected-case').textContent=`已選取：${item.customer || item.id}（報價版本 ${item.revision}）`;});
            }
            list.append(row);
        }
        options($('team-case-engineer'),directory.filter(item=>item.role==='ENGINEER').map(item=>({value:item.user_id,label:item.display_name})), '不分派／清除分派');
        options($('team-route-driver'),directory.filter(item=>['ENGINEER','DRIVER'].includes(item.role)).map(item=>({value:item.user_id,label:item.display_name+' · '+TEAM_ROLES[item.role]})),'請選擇收送人員');
    }
    function renderEmployees() {
        const list=$('team-employee-list'); list.replaceChildren();
        if(!manager()) return;
        for(const item of members) {
            const row=node('div',undefined,'border rounded-xl p-3 space-y-2');
            row.append(node('p',`${item.display_name} · ${item.email} · ${TEAM_ROLES[item.role]} · ${item.active?'啟用':'停用'} · ${item.user_id?'已開通':'未開通'}`,'text-sm break-words'));
            button(row,'載入員工設定',async()=>{ $('team-employee-email').value=item.email; $('team-employee-name').value=item.display_name; $('team-employee-role').value=item.role; $('team-employee-active').checked=item.active; });
            if(item.active && !item.user_id) button(row,'產生一次性開通連結（僅新帳號）',async()=>{
                const {data,error}=await client.functions.invoke('team-onboard',{body:{mode:'invite',orgId:org,email:item.email}});
                if(error || data?.error) throw new Error(data?.error || '無法開通，可能電子郵件已有帳號。此入口不會重設既有帳號。');
                const output=$('team-account-link'); output.replaceChildren(node('p',`請私下交給 ${item.email}，不可公開分享。`));
                const link=node('a','開啟一次性設定連結','text-blue-700 underline break-all'); link.href=data.url; link.target='_blank'; link.rel='noopener noreferrer'; output.append(link);
                const box=node('input'); box.readOnly=true; box.value=data.url; box.className='w-full border p-3 rounded-xl'; box.setAttribute('aria-label','一次性開通連結'); output.append(box);
                status('新帳號已開通。請由該員工本人開啟連結、設定密碼；不要公開張貼連結。');
                await refresh();
            });
            if(item.active && item.user_id) button(row,'寄送密碼重設信（由員工本人設定）',()=>sendReset(item.email));
            list.append(row);
        }
    }
    function renderRoutes() {
        const list=$('team-route-list'); list.replaceChildren();
        if(!routes.length) list.append(node('p','目前沒有可讀取的路線。'));
        for(const route of routes) {
            const row=node('div',undefined,'p-4 border rounded-xl space-y-2');
            const driver=directory.find(item=>item.user_id===route.driver_id)?.display_name || (route.driver_id===user.id?'本人':route.driver_id);
            row.append(node('p',`${route.name} · ${labels[route.status] || route.status} · ${driver}`,'font-bold'),node('p',`${new Date(route.starts_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})} ～ ${new Date(route.ends_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}`,'text-sm'));
            for(const stop of stops.filter(item=>item.route_id===route.id)) {
                const stopRow=node('div',undefined,'bg-slate-50 rounded-xl p-3 space-y-2');
                const job=cases.find(item=>item.id===stop.case_id);
                stopRow.append(node('p',`${stop.position}. ${stop.leg==='PICKUP'?'取件':'回送'} · ${job?.customer || stop.case_id} · ${labels[stop.status] || stop.status}`,'font-bold text-sm'),node('p',stop.address,'text-sm break-words'),node('p',`${new Date(stop.starts_at).toLocaleTimeString('zh-TW',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit'})} ～ ${new Date(stop.ends_at).toLocaleTimeString('zh-TW',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit'})}`,'text-xs'));
                if(route.status==='PUBLISHED' && stop.status==='PENDING' && (manager() || route.driver_id===user.id)) {
                    const note=node('input'); note.placeholder='交接備註；無法完成須填原因'; note.maxLength=1000; note.className='w-full border p-2 rounded-lg'; note.setAttribute('aria-label',`站點 ${stop.position} 回報備註`); stopRow.append(note);
                    for(const [label,value] of [['回報已完成','DONE'],['回報無法完成','FAILED']]) button(stopRow,label,async()=>{
                        await rpc('yj_update_stop',{p_stop:stop.id,p_route_revision:route.revision,p_status:value,p_note:note.value}); await refresh();
                    });
                } else if(stop.completion_note) stopRow.append(node('p',stop.completion_note,'text-sm'));
                row.append(stopRow);
            }
            if(operator() && route.status==='DRAFT') button(row,'載入路線草稿',async()=>{
                routeDraft={...route}; $('team-route-name').value=route.name; $('team-route-driver').value=route.driver_id;
                $('team-route-start').value=toLocal(route.starts_at); $('team-route-end').value=toLocal(route.ends_at);
                $('team-stop-editor').replaceChildren(); stops.filter(item=>item.route_id===route.id).forEach(item=>addStop(item));
                $('team-route-editing').textContent=`正在編輯：${route.name}（版本 ${route.revision}）`;
            });
            if(manager() && route.status==='DRAFT') button(row,'核准發布排線',async()=>{await rpc('yj_publish_route',{p_route:route.id,p_expected:route.revision}); await refresh();});
            if(manager() && ['DRAFT','PUBLISHED'].includes(route.status)) {
                const reason=node('input'); reason.placeholder='取消路線原因'; reason.maxLength=500; reason.className='border p-2 rounded-lg w-full'; reason.setAttribute('aria-label','取消路線原因'); row.append(reason);
                button(row,'取消此路線',async()=>{await rpc('yj_cancel_route',{p_route:route.id,p_expected:route.revision,p_reason:reason.value}); await refresh();});
            }
            list.append(row);
        }
    }
    const toLocal=isoToTaipeiInput;
    function addStop(value={}) {
        const row=node('div',undefined,'team-stop p-3 border rounded-xl space-y-2');
        const select=node('select'); select.dataset.stop='case'; select.setAttribute('aria-label','站點案件'); select.className='w-full border p-2 rounded-lg';
        options(select,cases.filter(item=>item.service==='PICKUP'&&!['DONE','CANCELLED'].includes(item.workflow)).map(item=>({value:item.id,label:(item.customer || '未填客戶')+' · '+(item.model||item.id)})),'請選擇案件'); select.value=value.case_id || ''; row.append(select);
        const leg=node('select'); leg.dataset.stop='leg'; leg.setAttribute('aria-label','取件或回送'); leg.className=select.className; options(leg,[{value:'PICKUP',label:'取件'},{value:'RETURN',label:'回送'}]); leg.value=value.leg || 'PICKUP'; row.append(leg);
        for(const [key,label,type,initial] of [['address','站點地址','text',value.address || ''],['starts_at','站點開始','datetime-local',value.starts_at?toLocal(value.starts_at):''],['ends_at','站點結束','datetime-local',value.ends_at?toLocal(value.ends_at):'']]) {
            const labelNode=node('label',label,'block text-sm'); const input=node('input'); input.dataset.stop=key; input.type=type; input.value=initial; input.maxLength=500; input.className='w-full border p-2 rounded-lg'; labelNode.append(input); row.append(labelNode);
        }
        const remove=node('button','移除此站','p-2 rounded-lg bg-slate-200 text-sm'); remove.type='button'; remove.onclick=()=>row.remove(); row.append(remove);
        $('team-stop-editor').append(row);
    }
    action($('team-login-btn'),async()=>{
        if(!client) throw new Error('團隊服務尚未設定');
        loginSession.begin($('team-login-mode').value);
        try { check(await client.auth.signInWithPassword({email:$('team-email').value.trim().toLowerCase(),password:$('team-password').value})); } finally { $('team-password').value=''; }
        client.auth.startAutoRefresh(); await refresh();
    });
    action($('team-signout'),async()=>{if(client) { const result=await client.auth.signOut({scope:'local'}); loginSession.clear(); if(result.error) status('此電腦已清除登入，連線恢復後請重新登入。'); } user=null; clear(); $('team-login').hidden=false; status('已登出並清除此程式在本瀏覽器記住的登入；本機報價仍保留。');});
    action($('team-set-password'),async()=>{
        const password=$('team-new-password').value;
        if(password.length<12 || password!==$('team-confirm-password').value) throw new Error('請使用至少 12 字元且兩次相同的密碼');
        check(await client.auth.updateUser({password,data:{yj_password_setup:false}}));
        recovery=false; $('team-new-password').value=''; $('team-confirm-password').value=''; await refresh(); status('密碼已設定，之後可使用電子郵件與密碼登入。');
    });
    action($('team-refresh'),refresh);
    async function sendReset(email) {
        email=email.trim().toLowerCase();
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('請先填寫正確的登入電子郵件');
        check(await client.auth.resetPasswordForEmail(email,{redirectTo:'https://yongjiesystems.github.io/testing/?reset=1'}));
        status('若帳號可接收重設信，請到該信箱（含垃圾郵件）開啟最新連結，由本人設定至少 12 字元的新密碼。未收到請聯絡系統管理人員。');
    }
    action($('team-forgot-password'),()=>sendReset($('team-email').value));
    action($('team-change-password'),async()=>{if(!user) throw new Error('請先登入'); recovery=true; $('team-password-setup').hidden=false; await onContext({client,user,org,role:null,cases:[],routes:[],stops:[]}); $('team-new-password').focus();});
    client?.auth.onAuthStateChange((event,session)=>{
        if(event==='SIGNED_OUT' || !session) { user=null;clear();$('team-login').hidden=false; }
        else if(event==='PASSWORD_RECOVERY') { recovery=true;setTimeout(()=>run(refresh),0); }
    });
    watchLoginSession(loginSession,()=>{ user=null; clear(); $('team-login').hidden=false; status('登入保存期限已到、已在其他分頁登出或變更帳號，請重新登入。'); client?.auth.stopAutoRefresh(); });
    $('team-org').onchange=()=>run(async()=>{org=$('team-org').value; selectedCase=null; routeDraft=null; $('team-account-link').replaceChildren(); await refresh();});
    action($('team-upload'),async()=>{
        if(!operator()) throw new Error('只有客服或主管可同步估價');
        const record=getRecord(); const payload=teamPayload(record,manager());
        const id=record.state.cloudOrgId===org ? record.state.cloudCaseId : (/^[0-9a-f-]{36}$/i.test(record.state.caseId || '') ? record.state.caseId : crypto.randomUUID());
        const expected=record.state.cloudOrgId===org && record.state.cloudCaseId ? record.state.cloudRevision : 0;
        const result=await rpc('yj_save_case',{p_org:org,p_case:id,p_expected:expected,p_record:payload.record,p_costs:payload.costs});
        onSaved(result,{orgId:org}); await refresh(); status(`已同步至團隊，版本 ${result.revision}；報價內容更新後須由主管核准才能發布排線。`);
    });
    const chosen=()=>{if(!selectedCase) throw new Error('請先從案件列表選取供主管處理的案件');return selectedCase;};
    action($('team-approve'),async()=>{const item=chosen();await rpc('yj_approve_case',{p_case:item.id,p_expected:item.revision,p_reason:$('team-case-reason').value});selectedCase=null;await refresh();});
    action($('team-assign'),async()=>{const item=chosen();await rpc('yj_assign_case',{p_case:item.id,p_expected:item.assignment_version,p_engineer:$('team-case-engineer').value || null}); selectedCase=null;await refresh();});
    for(const [id,value] of [['team-close-case','DONE'],['team-cancel-case','CANCELLED']]) action($(id),async()=>{const item=chosen();await rpc('yj_close_case',{p_case:item.id,p_expected:item.revision,p_status:value,p_reason:$('team-case-reason').value});selectedCase=null;await refresh();});
    action($('team-save-employee'),async()=>{await rpc('yj_set_employee',{p_org:org,p_email:$('team-employee-email').value,p_name:$('team-employee-name').value,p_role:$('team-employee-role').value,p_active:$('team-employee-active').checked});await refresh();});
    action($('team-new-route'),async()=>{routeDraft=null;$('team-route-editing').textContent='新路線草稿';$('team-route-name').value='';$('team-route-start').value='';$('team-route-end').value='';$('team-stop-editor').replaceChildren();});
    action($('team-add-stop'),async()=>{if($('team-stop-editor').children.length>=30) throw new Error('每條路線最多 30 個站點');addStop();});
    action($('team-save-route'),async()=>{
        if(!$('team-route-driver').value) throw new Error('請先開通收送人員或工程師帳號，再選擇路線人員');
        if(!$('team-stop-editor').children.length) throw new Error('請至少加入一個取件或回送站點');
        const items=[...$('team-stop-editor').children].map(row=>{const val=key=>row.querySelector(`[data-stop="${key}"]`).value;return {case_id:val('case'),leg:val('leg'),address:val('address'),starts_at:localToIso(val('starts_at')),ends_at:localToIso(val('ends_at'))};});
        const result=await rpc('yj_save_route',{p_org:org,p_route:routeDraft?.id || null,p_expected:routeDraft?.revision || 0,p_name:$('team-route-name').value,p_driver:$('team-route-driver').value,p_start:localToIso($('team-route-start').value),p_end:localToIso($('team-route-end').value),p_stops:items});
        routeDraft={id:result.id,revision:result.revision}; await refresh();$('team-route-editing').textContent=`草稿已存（版本 ${result.revision}），須由主管核准發布。`;
    });
    const timer=setInterval(()=>{if(user && !busy && !document.hidden && !document.activeElement?.closest('#section-team input, #section-team textarea, #section-team select')) run(refresh);},15000);
    window.addEventListener('pagehide',()=>{clearInterval(timer);$('team-account-link').replaceChildren();});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden && user && !busy) run(refresh);});
    run(async()=>{
        if(!client) {clear();status('團隊服務尚未啟用。');return;}
        const params=new URLSearchParams(location.hash.slice(1)); const token=params.get('team_token_hash');
        if(params.get('error_description')) { history.replaceState(null,'',location.pathname+location.search); throw new Error('密碼重設連結已失效，請重新寄送並開啟最新一封信。'); }
        if(params.get('type')==='recovery' && params.get('access_token') && params.get('refresh_token')) {
            history.replaceState(null,'',location.pathname+location.search);
            recovery=true; loginSession.begin('SESSION');
            check(await client.auth.setSession({access_token:params.get('access_token'),refresh_token:params.get('refresh_token')}));
            window.switchTab('team');
        }
        if(token) {
            history.replaceState(null,'',location.pathname+location.search);
            loginSession.begin('SESSION');
            check(await client.auth.verifyOtp({token_hash:token,type:'email'}));
            window.switchTab('team');
        }
        await refresh();
    });
}
