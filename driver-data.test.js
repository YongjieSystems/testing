import test from 'node:test';
import assert from 'node:assert/strict';
import {DRIVER_DATA,DRIVER_EXCLUSIONS,matchesDriver} from './driver-data.js';
import {WARRANTY_DATA} from './warranty-data.js';
test('every warranty brand is explicitly included or excluded without duplicate identities',()=>{
 const ids=[...DRIVER_DATA,...DRIVER_EXCLUSIONS].map(item=>item.id);
 assert.equal(new Set(ids).size,ids.length);
 assert.deepEqual(ids.toSorted(),WARRANTY_DATA.map(item=>item.id).toSorted());
 for(const item of DRIVER_DATA){assert.equal(item.name,WARRANTY_DATA.find(brand=>brand.id===item.id).name);assert.equal(new URL(item.url).protocol,'https:');assert.ok(item.note);assert.ok(item.checkedOn);assert.doesNotMatch(new URL(item.url).pathname,/\.(exe|zip|msi)$/i);}
});
test('driver filtering supports Chinese, English and overlapping HP product categories',()=>{
 const hp=DRIVER_DATA.find(item=>item.id==='HP');
 assert.ok(matchesDriver(hp,'hp 印表機','PRINTER'));assert.ok(matchesDriver(hp,'HP','COMPUTER'));
 assert.equal(matchesDriver(hp,'HP','DISPLAY'),false);
 assert.deepEqual(DRIVER_DATA.filter(item=>matchesDriver(item,'聯想')).map(item=>item.id),['Lenovo']);
 assert.equal(DRIVER_DATA.filter(item=>matchesDriver(item,'<script>')).length,0);
});
test('storage tools and distributors are not presented as generic driver downloads; Apple is a guide',()=>{
 for(const id of ['Weblink','Xander','Unitech','ADATA','Kingston','Transcend','Seagate','WD','Toshiba'])assert.ok(DRIVER_EXCLUSIONS.some(item=>item.id===id&&item.reason));
 const apple=DRIVER_DATA.find(item=>item.id==='Apple');assert.equal(apple.kind,'GUIDE');assert.match(apple.note,/Intel/);assert.match(apple.note,/不適用 Apple 晶片/);
 assert.equal(new URL(DRIVER_DATA.find(item=>item.id==='Lenovo').url).hostname,'support.lenovo.com');
});
