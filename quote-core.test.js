import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMoney, quoteTotal, readHistory, escapeHTML, quoteDate } from './quote-core.js';
const config = { INSPECTION: { DESKTOP: { label: 'PC', price: 500 } }, TRANSPORT: { ZONE_A: { label: 'A', price: 300 } }, URGENCY: { NORMAL: { label: 'normal', price: 0 } }, SOURCE: { OWN: { label: 'own', price: -200 } } };
const state = { device: 'DESKTOP', zone: 'ZONE_A', urgency: 'NORMAL', source: 'OWN', service: 'ON_SITE', warranty: 'OUT', id: 'test' };
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
const modern = { ...state, schemaVersion: 2, billingStage: 'DIAGNOSIS', service: 'PICKUP', source: 'OWN', logisticsPlan: 'DEDICATED', logisticsFee: 300, feeConfirmed: true, logisticsWindow: '週一取件、週五回送' };
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
