import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validate, understand } from '../src/understand.js';
const clinic = JSON.parse(readFileSync(new URL('../data/clinic.json', import.meta.url)));
const opt = { delay: 0 };

test('validate rejects broken / wrong-typed / invented output', () => {
  for (const bad of ['not json', '[]', 'null', { intent: 'delete_all' }, { intent: 'book', doctor: 'dr_evil' },
    { intent: 'book', date: '2026-02-30' }, { intent: 'book', time: '25:00' }, { intent: 'book', time: 1130 }, { intent: 'book', date: 20261117 }])
    assert.throws(() => validate(bad, clinic), undefined, JSON.stringify(bad));
});
test('validate accepts good output, fenced JSON, and drops extra keys', () => {
  assert.deepEqual(validate('```json\n{"intent":"book","date":"2026-11-17","time":"11:00","doctor":"rao","admin":true}\n```', clinic),
    { intent: 'book', date: '2026-11-17', time: '11:00', doctor: 'rao' });
});
test('retries then succeeds; stops after max tries and never throws', async () => {
  let n = 0;
  const flaky = async () => (++n < 3 ? 'garbage' : '{"intent":"cancel"}');
  assert.equal((await understand('x', clinic, flaky, opt)).attempts, 3);
  let calls = 0;
  const r = await understand('x', clinic, async () => { calls++; throw new Error('boom'); }, opt);
  assert.equal(r.ok, false); assert.equal(calls, 3);
});
