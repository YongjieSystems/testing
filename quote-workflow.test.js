import test from 'node:test';
import assert from 'node:assert/strict';
import {appendTemplate,dateHints,validDay,inspectionHints,repairHints,askOutput,taipeiToday} from './quote-workflow.js';
test('templates append without replacing employee notes, duplicates or truncation',()=>{
 assert.equal(appendTemplate('原本的說明','新增約定'),'原本的說明\n新增約定');
 assert.equal(appendTemplate('原文\n新增約定','新增約定'),'原文\n新增約定');
 assert.equal(appendTemplate('原文',''),'原文');assert.throws(()=>appendTemplate('原文','超長範本',3),/原內容已保留/);
});
test('Taipei calendar, leap dates and invalid dates are handled without UTC-day drift',()=>{
 assert.equal(taipeiToday(new Date('2026-11-04T17:00:00Z')),'2026-11-05');
 assert.equal(validDay('2028-02-29'),true);assert.equal(validDay('2026-02-29'),false);assert.equal(validDay('2026-13-01'),false);
});
test('date mistakes block delivery while expired quotations and backdated cases only warn',()=>{
 assert.match(dateHints({start:'2026-11-10',end:'2026-11-09'}).errors.join(),/早於/);
 assert.match(dateHints({start:'2026-11-05',end:'2029-11-06'}).errors.join(),/3年/);
 assert.equal(dateHints({start:'2026-11-05',end:'2029-11-05',today:'2026-11-05'}).errors.length,0);
 const h=dateHints({start:'2026-11-01',end:'2026-11-20',validUntil:'2026-11-04',today:'2026-11-05'});
 assert.equal(h.errors.length,0);assert.equal(h.warnings.length,2);
 assert.equal(dateHints({lines:[{start:'2027-01-01',end:'2026-12-31'}]}).errors.length,1);
 assert.match(dateHints({start:'2026-01-01',end:'2026-02-01',lines:[{end:'2030-01-01'}]}).errors.join(),/第1項租期/);
});
test('missing customer details are reminders, not manager approval requirements',()=>{
 const i=inspectionHints({date:'2026-11-05'},'',[],'2026-11-05');assert.equal(i.errors.length,0);assert.equal(i.warnings.length,3);
 const r=repairHints({},true);assert.equal(r.errors.length,0);assert.equal(r.warnings.length,2);
 assert.equal(repairHints({},false).errors.length,1);
 assert.equal(inspectionHints({date:'bad'},'').errors.length,1);
 assert.doesNotMatch([...i.warnings,...r.warnings].join(),/主管|核准/);
});
class Element {constructor(tag='div'){this.tag=tag;this.children=[];this.hidden=false;this.disabled=false;this.textContent='';}append(e){this.children.push(e)}replaceChildren(){this.children=[]}querySelectorAll(tag){return this.children.flatMap(e=>[...(e.tag===tag?[e]:[]),...e.querySelectorAll(tag)])}}
async function page(fn){const previous=globalThis.document;globalThis.document={createElement:t=>new Element(t)};try{await fn(new Element())}finally{globalThis.document=previous}}
test('inline output waits for employee confirmation and lets current-screen output skip saving',async()=>page(async host=>{
 let saved=0,output=0;askOutput(host,{errors:[],warnings:['客戶未填']},true,async()=>output++,async()=>saved++,()=>{});
 assert.equal(output,0);await host.querySelectorAll('button').find(b=>b.textContent==='只輸出目前畫面').onclick();
 assert.equal(saved,0);assert.equal(output,1);assert.equal(host.hidden,true);
}));
test('save-and-output waits for save success; repeated presses do not duplicate it',async()=>page(async host=>{
 let resolve,saved=0,output=0;const wait=new Promise(r=>resolve=r);
 askOutput(host,{errors:[],warnings:[]},true,async()=>output++,async()=>{saved++;await wait},()=>{});
 const b=host.querySelectorAll('button')[0];const first=b.onclick();await b.onclick();assert.equal(saved,1);assert.equal(output,0);resolve();await first;assert.equal(output,1);
}));
test('save failure or clipboard failure keeps confirmation available and original input intact',async()=>page(async host=>{
 let output=0,message='';askOutput(host,{errors:[],warnings:[]},true,async()=>output++,async()=>{throw Error('版本衝突')},m=>message=m);
 await host.querySelectorAll('button')[0].onclick();assert.equal(output,0);assert.equal(host.hidden,false);assert.equal(message,'版本衝突');
 assert.ok(host.querySelectorAll('button').every(b=>!b.disabled));
 askOutput(host,{errors:[],warnings:[]},false,async()=>{throw Error('剪貼簿拒絕')},async()=>{},m=>message=m);
 await host.querySelectorAll('button')[0].onclick();assert.equal(message,'剪貼簿拒絕');assert.equal(host.hidden,false);
}));
test('invalid data offers return-to-edit only and cannot be delivered',async()=>page(async host=>{
 let output=0;askOutput(host,{errors:['日期錯誤'],warnings:[]},true,async()=>output++,async()=>{},()=>{});
 const buttons=host.querySelectorAll('button');assert.equal(buttons.length,1);assert.equal(buttons[0].textContent,'返回修改');buttons[0].onclick();assert.equal(output,0);
}));

test('inspection team save keeps optimistic version and reports only successful writes',async()=>{
 const {readFileSync}=await import('node:fs'),vm=await import('node:vm');const source=readFileSync(new URL('./team-workspace.js',import.meta.url),'utf8');
 const body=source.slice(source.indexOf('    async function saveCurrent()'),source.indexOf("    action($('team-upload')"));
 let writes=0,notified=0,last,fail=false;
 const state={cloudOrgId:'org',cloudCaseId:'case',cloudRevision:4};
 const ctx={org:'org',operator:()=>true,manager:()=>false,getRecord:()=>({state,problem:'測試'}),teamPayload:r=>({record:r,costs:null}),crypto:globalThis.crypto,
 rpc:async(name,args)=>{writes++;last=args;if(fail)throw Error('版本衝突');return {revision:5};},onSaved:()=>notified++,refresh:async()=>{},status(){}};
 vm.runInNewContext(body+';this.save=saveCurrent',ctx);await ctx.save();assert.equal(last.p_expected,4);assert.equal(notified,1);
 fail=true;await assert.rejects(ctx.save(),/版本衝突/);assert.equal(notified,1);assert.equal(writes,2);assert.equal(ctx.save.running,false);
});

test('modern clipboard succeeds without creating fallback elements',async()=>{
 const {copyCustomerText}=await import('./quote-workflow.js');let actual='';assert.equal(await copyCustomerText('報價',{navigator:{clipboard:{writeText:async t=>actual=t}},document:{createElement(){throw Error('must not run')}}}),true);assert.equal(actual,'報價');
});
test('clipboard denial uses selection copy, restores focus and removes transient field',async()=>{
 const {copyCustomerText}=await import('./quote-workflow.js');let selected=false,removed=false,focused=false,inside=false;
 const field={style:{},setAttribute(){},focus(){},select(){selected=true},setSelectionRange(){},remove(){removed=true}};
 const doc={activeElement:{focus(){focused=true}},body:{append(){}},querySelector:()=>({append(){inside=true}}),createElement:()=>field,execCommand:command=>command==='copy'&&selected};
 assert.equal(await copyCustomerText('測試報價',{navigator:{clipboard:{writeText:async()=>{throw Error('denied')}}},document:doc}),true);assert.equal(field.value,'測試報價');assert.ok(removed&&focused&&inside);
});
test('unavailable or denied clipboard can fall back to manual copying without throwing',async()=>{
 const {copyCustomerText}=await import('./quote-workflow.js');assert.equal(await copyCustomerText('報價',{navigator:{},document:{}}),false);
 const field={style:{},setAttribute(){},focus(){},select(){},remove(){}};assert.equal(await copyCustomerText('報價',{navigator:{},document:{body:{append(){}},createElement:()=>field,execCommand:()=>false}}),false);
});

test('manual copy dialog contains only customer text and selects the complete quotation',async()=>{
 const {copyCustomerQuote}=await import('./quote-workflow.js');
 class Node{constructor(tag){this.tag=tag;this.children=[];this.style={};this.attributes={};}append(...nodes){this.children.push(...nodes)}setAttribute(k,v){this.attributes[k]=v}focus(){}select(){this.selected=true}setSelectionRange(a,b){this.range=[a,b]}showModal(){this.open=true}remove(){this.removed=true}close(){this.open=false}}
 const doc={body:new Node('body'),createElement:t=>new Node(t)};let notice='';const quote='【客戶報價】\n設備1000元';
 assert.equal(await copyCustomerQuote(quote,m=>notice=m,{navigator:{},document:doc}),false);assert.match(notice,/自動複製未完成/);assert.doesNotMatch(notice,/✓/);
 const dialog=doc.body.children.find(n=>n.tag==='dialog');assert.equal(dialog.open,true);const field=dialog.children.find(n=>n.tag==='textarea');assert.equal(field.value,quote);dialog.children.at(-1).children[0].onclick();assert.deepEqual(field.range,[0,quote.length]);
});
