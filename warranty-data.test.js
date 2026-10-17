import test from 'node:test';
import assert from 'node:assert/strict';
import { WARRANTY_DATA, WARRANTY_KINDS, WARRANTY_ACTIONS } from './warranty-data.js';

test('every warranty entry has an HTTPS URL, unique identity and explicit query type', () => {
    const ids = new Set();
    for (const brand of WARRANTY_DATA) {
        assert.ok(brand.id && !ids.has(brand.id)); ids.add(brand.id);
        const url = new URL(brand.url);
        assert.equal(url.protocol, 'https:');
        assert.equal(url.username, ''); assert.equal(url.password, '');
        assert.ok(Object.hasOwn(WARRANTY_KINDS, brand.kind));
        assert.ok(WARRANTY_ACTIONS[brand.kind]);
        assert.ok(brand.note.length > 10);
        assert.match(brand.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
    }
});

test('known broken Toshiba address is not published', () => {
    const entry = WARRANTY_DATA.find(item => item.id === 'Toshiba');
    assert.equal(new URL(entry.url).pathname, '/tw/registration');
    assert.match(entry.note, /代理品/);
});

test('policy, model and login pages are not advertised as serial lookup forms', () => {
    for (const id of ['Unitech','Philips','AOC','Kingston','Canon']) {
        assert.notEqual(WARRANTY_DATA.find(item=>item.id===id).kind, 'SERIAL');
    }
    assert.equal(WARRANTY_DATA.find(item=>item.id==='Canon').kind, 'MODEL');
    assert.equal(WARRANTY_DATA.find(item=>item.id==='Unitech').kind, 'LOGIN');
});
