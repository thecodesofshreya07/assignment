import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../src/db.js';
import { createServer } from '../src/server.js';

const clinic = JSON.parse(readFileSync(new URL('../data/clinic.json', import.meta.url)));
const N = 20;

test(`${N} parallel DB connections (threads) race for one slot: exactly one wins`, async () => {
  const path = join(mkdtempSync(join(tmpdir(), 'cb-')), 't.db');
  openDb(path).close();
  const rs = await Promise.all(Array.from({ length: N }, (_, i) => new Promise((res, rej) => {
    const w = new Worker(new URL('./worker.js', import.meta.url), { workerData: { path, phone: '+' + i } });
    w.once('message', res); w.once('error', rej);
  })));
  assert.equal(rs.filter((r) => r.ok).length, 1);
  assert.ok(rs.filter((r) => !r.ok).every((r) => r.reason === 'SLOT_TAKEN'));
});

test(`${N} parallel HTTP requests for one slot: one 201, rest 409`, async () => {
  const db = openDb(), server = createServer(clinic, db);
  await new Promise((r) => server.listen(0, r));
  const url = `http://127.0.0.1:${server.address().port}/book`;
  const codes = await Promise.all(Array.from({ length: N }, (_, i) => fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ doctorId: 'iyer', date: '2026-11-17', time: '13:00', phone: '+' + i }),
  }).then((r) => r.status)));
  server.closeAllConnections?.(); server.close();
  assert.equal(codes.filter((c) => c === 201).length, 1);
  assert.equal(codes.filter((c) => c === 409).length, N - 1);
});
