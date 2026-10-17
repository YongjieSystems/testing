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
