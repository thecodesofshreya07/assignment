import { parentPort, workerData } from 'node:worker_threads';
import { readFileSync } from 'node:fs';
import { openDb } from '../src/db.js';
import { book } from '../src/service.js';
const clinic = JSON.parse(readFileSync(new URL('../data/clinic.json', import.meta.url)));
parentPort.postMessage(book(clinic, openDb(workerData.path), { doctorId: 'rao', date: '2026-11-18', time: '12:00', phone: workerData.phone }));
