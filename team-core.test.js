import test from 'node:test';
import assert from 'node:assert/strict';
import { teamPayload, PRIVATE_COST_FIELDS, teamError, localToIso, isoToTaipeiInput } from './team-core.js';
test('team upload never mixes private costs into a staff quote or customer record',()=>{
 const record={state:{device:'DESKTOP',hourlyCost:250,actualNotes:'internal',actualRevenue:300,pricing:{secret:'forged'},cloudRevision:8,cloudCaseId:'old'},problem:'no power',total:99};
 const staff=teamPayload(record); assert.equal(staff.costs,null);
 for(const key of [...PRIVATE_COST_FIELDS,'pricing','cloudRevision','cloudCaseId']) assert.equal(Object.hasOwn(staff.record.state,key),false);
 const manager=teamPayload(record,true); assert.equal(manager.costs.hourlyCost,250);assert.equal(manager.costs.actualNotes,'internal');
 assert.equal(manager.record.state.actualRevenue,undefined); assert.equal(record.state.actualRevenue,300);
});
test('team conflict errors explain that another editor was not overwritten',()=>{
 assert.match(teamError({code:'40001'}),/尚未送出/);assert.match(teamError({code:'42501'}),/權限不足/);
 assert.match(teamError(null),/內容仍保留/); assert.throws(()=>localToIso('bad'),/日期/);
 assert.equal(localToIso('2026-10-20T09:00:00+08:00'),'2026-10-20T01:00:00.000Z');
});

test('route inputs use Taipei time independently of the device timezone',()=>{
 assert.equal(localToIso('2026-10-20T09:00'),'2026-10-20T01:00:00.000Z');
 assert.equal(isoToTaipeiInput('2026-10-19T16:00:00Z'),'2026-10-20T00:00');
 assert.equal(isoToTaipeiInput('2026-10-20T01:00:00Z'),'2026-10-20T09:00');
});
