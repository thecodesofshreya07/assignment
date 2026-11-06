import { readFileSync, rmSync } from 'node:fs';
import { openDb } from './db.js';
import { createServer } from './server.js';
import { makeClient } from './client.js';
import { understand, groqLlm, geminiLlm, mockLlm } from './understand.js';
import { decide } from './decide.js';

const rd = (f) => JSON.parse(readFileSync(new URL('../data/' + f, import.meta.url)));
const clinic = rd('clinic.json'), messages = rd('messages.json'), expected = rd('expected.json');
const dbPath = process.env.DB_PATH || 'bookings.db';
for (const s of ['', '-wal', '-shm']) rmSync(dbPath + s, { force: true });
const db = openDb(dbPath), server = createServer(clinic, db);
await new Promise((r) => server.listen(0, r));
const api = makeClient(`http://127.0.0.1:${server.address().port}`);
const mock = process.env.PARSER === 'mock';
const name = mock ? 'mock' : process.env.GROQ_API_KEY ? 'groq' : process.env.GEMINI_API_KEY ? 'gemini' : 'mock';
const useLlm = name !== 'mock';
const llm = { groq: () => groqLlm(clinic), gemini: () => geminiLlm(clinic), mock: () => mockLlm(clinic) }[name]();
console.log(`Parser: ${useLlm ? name + ' API' : 'MOCK rules (no API key)'}\n`);

const handle = async (m) => ({ m, ...(await decide(api, clinic, m, await understand(m.text, clinic, llm, { delay: useLlm ? 300 : 0 }))) });
const results = [];
for (let i = 0; i < messages.length; i++) {
  const m = messages[i], n = messages[i + 1];
  if (m.sent_at_same_time_as && n?.id === m.sent_at_same_time_as) { results.push(...(await Promise.all([handle(m), handle(n)]))); i++; }
  else results.push(await handle(m));
}
for (const r of results) console.log(`[${r.m.id}] ${r.m.from}: "${r.m.text}"\n  -> ${r.action.toUpperCase()}\n  ${r.reply.replace(/\n/g, '\n  ')}\n`);

const key = (s) => s && `${s.doctorId} ${s.date} ${s.time}`;
const raceBooked = results.filter((r) => expected[r.m.id].action === 'book_or_refuse' && r.action === 'book').length;
let wrong = db.prepare("SELECT COUNT(*) n FROM (SELECT 1 FROM bookings WHERE status='booked' GROUP BY doctor_id,date,time HAVING COUNT(*)>1)").get().n;
let needless = 0, correct = 0;
for (const r of results) {
  const e = expected[r.m.id];
  const bookedOk = r.action === 'book' && key(r.booking) === e.slot;
  if (r.action === 'book' && !bookedOk) { wrong++; console.log(`WRONG BOOKING ${r.m.id}: got ${key(r.booking)}, expected ${e.slot || e.action}`); }
  if (r.action === 'cancel' && e.action !== 'cancel') { wrong++; console.log(`WRONG CANCEL ${r.m.id}`); }
  if (r.action === 'ask' && ['book', 'cancel'].includes(e.action)) needless++;
  let ok = e.action === 'book_or_refuse' ? (bookedOk || r.action === 'refuse') && raceBooked === 1 : e.action === 'book' ? bookedOk : r.action === e.action;
  if (ok) correct++; else console.log(`MISMATCH ${r.m.id}: expected ${e.action}, got ${r.action}`);
}
console.log(`Wrong bookings (wrong slot / wrong cancel / double): ${wrong}`);
console.log(`Needless questions (request was clear): ${needless}`);
console.log(`Handled correctly: ${correct}/${results.length}`);
server.closeAllConnections?.(); server.close(); db.close();
process.exitCode = wrong ? 1 : 0;
