import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as core from './quote-core.js';
import { CONFIG } from './pricing-config.js';
import { teamPayload } from './team-core.js';

const base={schemaVersion:2,id:'service-test',device:'DESKTOP',service:'IN_STORE',zone:'ZONE_A',urgency:'NORMAL',source:'OTHER',warranty:'OUT',status:'DRAFT',billingStage:'DIAGNOSIS',logisticsPlan:'DEDICATED',logisticsFee:'450',feeConfirmed:true,logisticsWindow:'週一取件，週三回送',windowConfirmed:true,hourlyCost:'999',actualNotes:'INTERNAL_ONLY'};

test('store delivery stays zero and each original onsite zone price stays unchanged, including after custom service',()=>{
 for(const schemaVersion of [undefined,2]) {
  const s={...base,schemaVersion};
  assert.equal(core.quoteTotal(s,CONFIG),500);
  for(const [zone,travel,total] of [['ZONE_A',300,800],['ZONE_B',700,1200],['ZONE_C',1200,1700],['MOUNTAIN',3000,3500],['ISLAND',8000,8500]]) {
   const onsite={...s,service:'ON_SITE',zone};
   assert.equal(core.calculateQuote(onsite,CONFIG).transPrice,travel);
   assert.equal(core.quoteTotal(onsite,CONFIG),total);
   assert.deepEqual(core.calculateQuote(onsite,CONFIG).pending,[]);
  }
 }
 assert.equal(core.quoteTotal({...base,service:'PICKUP',zone:'ISLAND'},CONFIG),950);
 assert.equal(core.quoteTotal({...base,service:'IN_STORE',zone:'ISLAND'},CONFIG),500);
});

test('customer texts use the three service names and exclude inactive plans and internal analysis',()=>{
 const store=core.generateQuoteSummary(base,'無法開機',CONFIG,'2026-10-21');
 assert.match(store,/服務：門市檢測/);assert.match(store,/自行送件.*不收收送費/);assert.match(store,/合計：NT\$ 500/);
 const onsite=core.generateQuoteSummary({...base,service:'ON_SITE'},'',CONFIG,'2026-10-21');
 assert.match(onsite,/服務：到府檢測/);assert.match(onsite,/到府出勤費：\$300/);
 const custom=core.generateQuoteSummary({...base,service:'PICKUP'},'',CONFIG,'2026-10-21');
 assert.match(custom,/服務：客製化收送服務/);assert.match(custom,/收送費.*\$450/);assert.match(custom,/預約專程收送/);
 for(const text of [store,onsite,custom]) assert.doesNotMatch(text,/INTERNAL_ONLY|999|到府檢修|收回公司檢測/);
 for(const text of [store,onsite]) assert.doesNotMatch(text,/預約專程收送|週一取件/);
});

test('existing custom service codes and price snapshots survive history and team synchronization',()=>{
 const pricing=structuredClone(CONFIG);pricing.INSPECTION.DESKTOP.price=450;
 const record={state:{...base,service:'PICKUP',pricing},problem:'無法開機',timestamp:'2026/10/21 12:00:00',total:'900'};
 const [restored]=core.readHistory(JSON.stringify([record]),CONFIG);
 assert.equal(restored.state.service,'PICKUP');assert.equal(core.quoteTotal(restored.state,restored.state.pricing),900);
 const upload=teamPayload(restored,true);
 assert.equal(upload.record.state.service,'PICKUP');assert.equal(upload.record.state.logisticsFee,450);
 assert.equal(upload.costs.actualNotes,'INTERNAL_ONLY');assert.equal(upload.record.state.actualNotes,undefined);
});

test('real fulfillment renderer hides and disables custom analysis in store/onsite, retaining values when switching back',()=>{
 const source=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');
 const render=source.match(/function renderFulfillment\(\) \{[\s\S]*?\n        \}/)[0];
 const elements=new Map(), fields=['logisticsFee','hourlyCost','actualNotes','billingStage','paidAmount'].map(key=>({dataset:{quoteField:key},type:'text',value:'',disabled:false}));
 const customFields=fields.slice(0,3),details=[{open:true},{open:true}];
 const el=id=>{if(!elements.has(id))elements.set(id,{textContent:'',hidden:false,querySelectorAll:selector=>selector==='details'?details:customFields});return elements.get(id)};
 const s={...base,service:'PICKUP'};
 const context={...core,state:s,$:el,pricesFor:()=>CONFIG,document:{querySelectorAll:()=>fields,activeElement:null},console};
 vm.runInNewContext(render+';this.draw=renderFulfillment;',context);
 context.draw();assert.equal(el('logistics-controls').hidden,false);assert.equal(customFields.every(f=>!f.disabled),true);
 for(const service of ['IN_STORE','ON_SITE']) {
  s.service=service;context.draw();assert.equal(el('logistics-controls').hidden,true);
  assert.equal(customFields.every(f=>f.disabled),true);assert.equal(details.every(d=>!d.open),true);
  assert.equal(fields[3].disabled,false);assert.equal(fields[4].disabled,false);
  assert.equal(el('cost-assessment').textContent,'');assert.equal(el('fulfillment-title').textContent,'案件計費');
 }
 s.service='PICKUP';context.draw();assert.equal(el('logistics-controls').hidden,false);
 assert.equal(customFields[0].value,'450');assert.equal(s.actualNotes,'INTERNAL_ONLY');
 assert.equal(customFields.every(f=>!f.disabled),true);
});
