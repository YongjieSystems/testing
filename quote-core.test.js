import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMoney, quoteTotal, readHistory, escapeHTML, quoteDate } from './quote-core.js';
import { formatQuoteId, generateQuoteSummary } from './quote-core.js';
import { CONFIG as productionConfig } from './pricing-config.js';
const config = { INSPECTION: { DESKTOP: { label: 'PC', price: 500 } }, TRANSPORT: { ZONE_A: { label: 'A', price: 300 } }, URGENCY: { NORMAL: { label: 'normal', price: 0 } }, SOURCE: { OWN: { label: 'own', price: -200 } } };
const state = { device: 'DESKTOP', zone: 'ZONE_A', urgency: 'NORMAL', source: 'OWN', service: 'ON_SITE', warranty: 'OUT', id: 'test' };
test('short quote references are stable, case independent and retain differences at the end of an ID',()=>{
 const id='c6f4759d-169d-4e23-bcae-e03ca12e5aaa';
 assert.match(formatQuoteId(id),/^YJ-[0-9A-Z]{13}$/);
 assert.equal(formatQuoteId(id),formatQuoteId(id.toUpperCase()));
 assert.notEqual(formatQuoteId(id),formatQuoteId(id.slice(0,-1)+'b'));
 const record={state:{...state,id}};
 assert.ok(matchesRecord(record,formatQuoteId(id)));
 assert.ok(matchesRecord(record,id));
 assert.ok(matchesRecord(record,'YJ-'+id));
});
test('customer summary omits previous references and uses the selected urgency name and fee',()=>{
 const input={...state,schemaVersion:2,service:'IN_STORE',urgency:'EXPRESS',source:'OTHER',status:'DRAFT',department:'維修服務部',previousQuoteId:'previous-private-id'};
 const summary=generateQuoteSummary(input,'測試故障',productionConfig,'2026-10-18');
 assert.match(summary,/報價單號：YJ-[0-9A-Z]{13}/);
 assert.doesNotMatch(summary,/前版單號|previous-private-id/);
 assert.match(summary,/檢修急件（時限另約）：\$500/);
 assert.match(generateQuoteSummary({...input,urgency:'EMERGENCY'},'',productionConfig,'2026-10-18'),/假日檢修：\$800/);
 assert.equal(calculateQuote({...input,urgency:'EMERGENCY'},productionConfig).lines.find(line=>line.key==='urgency').label,'假日檢修');
});
test('money rejects negatives, fractions, non-finite values and caps excessive values', () => {
  for (const [input, expected] of [[-100,0],['',0],['1e309',0],['abc',0],[1.9,1],[2000000,1000000]]) assert.equal(normalizeMoney(input),expected);
});
test('pricing accounts for travel, source discounts and prevents negative totals', () => {
  assert.equal(quoteTotal(state,config),600);
  assert.equal(quoteTotal({...state, service:'IN_STORE'},config),300);
  assert.equal(quoteTotal({...state, otherFee:-100},config),600);
  assert.equal(quoteTotal({...state, specialDiscount:1000},config),0);
});
test('history rejects malformed storage and unknown enum keys', () => {
  for (const raw of ['{', '{}', '[null]', JSON.stringify([{state:{...state,device:'__proto__'}}])]) assert.deepEqual(readHistory(raw,config),[]);
});
test('legacy history migrates money fields and complete price snapshots survive rate changes', () => {
  const record={state:{...state, pricing: structuredClone(config)},timestamp:'2026/10/17 12:00:00',problem:'test',total:'600'};
  const [restored]=readHistory(JSON.stringify([record]),config);
  assert.equal(restored.state.otherFee,0);
  const changed=structuredClone(config); changed.INSPECTION.DESKTOP.price=900;
  assert.equal(quoteTotal(restored.state,restored.state.pricing),600);
  assert.equal(quoteTotal(restored.state,changed),1000);
});
test('history HTML escapes attribute delimiters and markup', () => {
  assert.equal(escapeHTML('\"><img src=x onerror=alert(1)>'), '&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
});
test('quote dates use Taipei day across UTC midnight boundary', () => assert.equal(quoteDate(new Date('2026-10-16T17:00:00Z')),'2026-10-17'));

import { QUOTE_STATUS, upsertRecord, mergeRecords, matchesRecord, parseBackup } from './quote-core.js';
const saved = (id, extra = {}) => ({ state: { ...state, id, ...extra }, timestamp: '2026/10/17 12:00:00', problem: '無法開機', total: '600' });
const backup = records => JSON.stringify({format:'yj-quote-backup',version:1,records});
test('saving the same quote updates without duplicates and retains other quotes', () => {
  const old=saved('one'); const updated=saved('one',{customerName:'王先生'});
  const records=upsertRecord([old,saved('two')],updated);
  assert.deepEqual(records.map(r=>r.state.id),['one','two']); assert.equal(records[0].state.customerName,'王先生');
});
test('save capacity retains newest records', () => assert.deepEqual(upsertRecord([saved('old'),saved('older')],saved('new'),2).map(r=>r.state.id),['new','old']));
test('backup merge keeps local conflicting quotes and adds new quotes', () => {
  const local=saved('same',{customerName:'local'});
  const result=mergeRecords([local],[saved('same',{customerName:'incoming'}),saved('new')]);
  assert.equal(result[0].state.customerName,'local'); assert.equal(result.length,2);
});
test('over-capacity import is rejected without mutating local records', () => {
  const records=[saved('local')]; assert.throws(()=>mergeRecords(records,[saved('incoming')],1),/上限/); assert.equal(records.length,1);
});
test('search combines customer, model, staff and status filters', () => {
  const item=saved('ABC',{customerName:'永捷',deviceModel:'ThinkPad T14',staffName:'小王',status:'QUOTED'});
  assert.ok(matchesRecord(item,'永捷 t14','QUOTED')); assert.ok(matchesRecord(item,'abc 小王'));
  assert.equal(matchesRecord(item,'t14','DONE'),false); assert.equal(matchesRecord(item,'other'),false);
});
test('legacy records receive metadata defaults and malicious prototype status is rejected', () => {
  const [item]=readHistory(JSON.stringify([saved('old',{status:'__proto__',customerName:[]})]),config);
  assert.equal(item.state.status,'DRAFT'); assert.equal(item.state.customerName,''); assert.equal(item.state.deviceModel,'');
});
test('valid backup round-trip preserves metadata and price snapshot', () => {
  const [item]=parseBackup(backup([saved('one',{pricing:config,customerName:'王先生',deviceModel:'PC-1',status:'DONE'})]),config);
  assert.equal(item.state.customerName,'王先生'); assert.equal(item.state.status,'DONE'); assert.deepEqual(item.state.pricing,config);
});
test('backup rejects unsupported format, bad JSON, invalid records and too many rows', () => {
  for (const raw of ['{','null','[]',JSON.stringify({format:'yj-quote-backup',version:2,records:[]}),backup([null])]) assert.throws(()=>parseBackup(raw,config));
  assert.throws(()=>parseBackup(backup([saved('1'),saved('2')]),config,1),/上限/);
});
test('backup rejects inconsistent totals and invalid price snapshots', () => {
  assert.throws(()=>parseBackup(backup([{...saved('one',{pricing:config}),total:'999'}]),config),/不一致/);
  assert.throws(()=>parseBackup(backup([saved('one',{pricing:{}})]),config),/價格/);
});

import { calculateQuote, assessLogistics } from './quote-core.js';
const modern = { ...state, schemaVersion: 2, billingStage: 'DIAGNOSIS', service: 'PICKUP', source: 'OWN', logisticsPlan: 'DEDICATED', logisticsFee: 300, feeConfirmed: true, windowConfirmed: true, logisticsWindow: '週一取件、週五回送' };
test('pickup replaces onsite travel with a single complete collection and return fee', () => {
  const result=calculateQuote(modern,config);
  assert.equal(result.total,600); assert.equal(result.transPrice,300); assert.deepEqual(result.pending,[]);
  assert.equal(quoteTotal({...modern,service:'IN_STORE'},config),300);
});
test('unknown logistics is explicitly pending and not silently sold as free', () => {
  for (const logisticsFee of ['',undefined,null,-1,Infinity]) {
    const result=calculateQuote({...modern,logisticsFee},config);
    assert.equal(result.transPrice,0); assert.ok(result.pending.some(text=>text.includes('收送費')));
  }
  assert.ok(calculateQuote({...modern,feeConfirmed:false},config).pending.length);
  assert.equal(calculateQuote({...modern,logisticsFee:0},config).pending.length,0);
});
test('economic routing needs an actual confirmed route and both trip windows', () => {
  assert.ok(calculateQuote({...modern,logisticsPlan:'SCHEDULED'},config).pending.some(text=>text.includes('排線')));
  assert.equal(calculateQuote({...modern,logisticsPlan:'SCHEDULED',routeConfirmed:true},config).pending.length,0);
  assert.ok(calculateQuote({...modern,logisticsWindow:''},config).pending.length);
});
test('agreed repair replaces diagnosis and its discount without adding return again', () => {
  const result=calculateQuote({...modern,billingStage:'REPAIR',repairFee:1200,repairConfirmed:true},config);
  assert.equal(result.total,1500); assert.equal(result.discPrice,0); assert.deepEqual(result.pending,[]);
  assert.ok(calculateQuote({...modern,billingStage:'REPAIR',repairFee:1200},config).pending.length);
});
test('new purchase discount cannot consume transport while legacy records keep the original calculation', () => {
  const cheaper=structuredClone(config); cheaper.INSPECTION.DESKTOP.price=100;
  assert.equal(calculateQuote(modern,cheaper).total,300);
  assert.equal(quoteTotal({...state},cheaper),200);
});
test('cost assessment requires every cost, includes complete travel cycle and uses margin rather than markup', () => {
  const costs={...modern,logisticsMinutes:30,hourlyCost:250,travelCost:100,logisticsOtherCost:0,targetMargin:20};
  assert.match(assessLogistics(costs),/225/); assert.match(assessLogistics(costs),/282/);
  assert.match(assessLogistics({...costs,logisticsMinutes:60}),/438/);
  assert.match(assessLogistics({...costs,travelCost:''}),/未齊/);
  assert.match(assessLogistics({...costs,targetMargin:100}),/小於/);
});
test('new pickup backups round-trip, preserve unknown costs and reject forged plan or phase', () => {
  const record=saved('pickup',{...modern,pricing:config,logisticsOtherCost:''});
  const [restored]=parseBackup(backup([record]),config);
  assert.equal(restored.state.logisticsOtherCost,''); assert.equal(restored.state.feeConfirmed,true);
  assert.equal(quoteTotal(restored.state,restored.state.pricing),600);
  for (const changes of [{logisticsPlan:'__proto__'},{billingStage:'other'},{schemaVersion:3}]) assert.throws(()=>parseBackup(backup([{...record,state:{...record.state,...changes}}]),config));
});


import { reviewLogistics, summarizeLogistics } from './quote-core.js';
const settled = { ...modern, status:'DONE', logisticsMinutes:30, hourlyCost:250, travelCost:100, logisticsOtherCost:0,
  actualMinutes:60, actualEngineerMinutes:40, actualHourlyCost:250, actualTravelCost:100, actualOtherCost:0, actualRevenue:300, actualConfirmed:true };
test('a typed window or a string truth value is not confirmed customer scheduling', () => {
  assert.ok(calculateQuote({...modern,windowConfirmed:undefined},config).pending.some(text=>text.includes('時段')));
  assert.ok(calculateQuote({...modern,windowConfirmed:'true'},config).pending.some(text=>text.includes('時段')));
  assert.ok(calculateQuote({...modern,logisticsWindow:''},config).pending.some(text=>text.includes('時段')));
});
test('actual costs count engineer time inside total labor once, compare estimated costs and compute margin', () => {
  const result=reviewLogistics(settled);
  assert.equal(result.ready,true); assert.equal(result.cost,350); assert.equal(result.contribution,-50);
  assert.equal(result.estimatedCost,225); assert.equal(result.variance,125); assert.equal(result.engineerMinutes,40);
  assert.equal(result.margin,-50/300*100);
});
test('unknown actual costs, unreviewed entries and impossible labor totals never become verified profit', () => {
  for (const value of ['',undefined,null,true,[],Infinity,-1]) assert.equal(reviewLogistics({...settled,actualOtherCost:value}).ready,false);
  assert.equal(reviewLogistics({...settled,actualConfirmed:false}).ready,false);
  assert.equal(reviewLogistics({...settled,actualEngineerMinutes:61}).ready,false);
  const free=reviewLogistics({...settled,actualRevenue:0}); assert.equal(free.ready,true); assert.equal(free.margin,null); assert.equal(free.contribution,-350);
  assert.equal(reviewLogistics({...settled,travelCost:''}).variance,null);
});
const caseRecord=(id,changes={})=>saved(id,{...settled,id,...changes});
test('reports count only the latest completed and reviewed case, not its earlier quotation versions', () => {
  const report=summarizeLogistics([caseRecord('new',{previousQuoteId:'old'}),caseRecord('old'),caseRecord('draft',{status:'DRAFT'}),caseRecord('missing',{actualOtherCost:''}),caseRecord('unchecked',{actualConfirmed:false})]);
  const group=report.groups.DEDICATED;
  assert.equal(group.count,1); assert.equal(group.revenue,300); assert.equal(group.cost,350); assert.equal(group.engineerMinutes,40);
  assert.equal(group.underestimated,1); assert.equal(group.comparable,1); assert.equal(report.open,1); assert.equal(report.awaiting,2);
});
test('stable case identities survive missing parents and branched or cyclic legacy references', () => {
  const records=[caseRecord('latest',{caseId:'root',previousQuoteId:'missing'}),caseRecord('older',{caseId:'root'}),caseRecord('branch-a',{previousQuoteId:'branch-root'}),caseRecord('branch-b',{previousQuoteId:'branch-root'}),caseRecord('cycle-a',{previousQuoteId:'cycle-b'}),caseRecord('cycle-b',{previousQuoteId:'cycle-a'})];
  assert.equal(summarizeLogistics(records).groups.DEDICATED.count,3);
});
test('latest cancellation, reopened case or changed service supersedes old completed reports', () => {
  for (const changes of [{status:'CANCELLED'},{status:'DRAFT'},{service:'IN_STORE'}]) {
    const report=summarizeLogistics([caseRecord('new',{previousQuoteId:'old',...changes}),caseRecord('old')]);
    assert.equal(report.groups.DEDICATED.count,0);
  }
  assert.equal(summarizeLogistics([caseRecord('new',{previousQuoteId:'old',actualConfirmed:false}),caseRecord('old')]).awaiting,1);
});
test('actual costs, notes and case identity survive backup import without changing customer charges', () => {
  const record=caseRecord('backup',{pricing:config,caseId:'root',actualNotes:'等待與回送交通'});
  const [restored]=parseBackup(backup([record]),config);
  assert.equal(restored.state.caseId,'root'); assert.equal(restored.state.actualNotes,'等待與回送交通');
  assert.equal(reviewLogistics(restored.state).ready,true); assert.equal(quoteTotal(restored.state,config),600);
  const [older]=readHistory(JSON.stringify([saved('old-pickup',{...modern,windowConfirmed:undefined})]),config);
  assert.equal(older.state.windowConfirmed,false); assert.equal(older.state.actualMinutes,'');
});
