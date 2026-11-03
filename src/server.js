import http from 'node:http';
import { freeSlots, book, cancel, myBookings, nearestFreeSlots } from './service.js';
import { bookingsForDate } from './db.js';
import { isRealDate, isValidTime } from './slots.js';

// Thin HTTP layer. All rules live in slots.js/service.js, not here.
export function createServer(clinic, db) {
  return http.createServer(async (req, res) => {
    const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    try {
      const u = new URL(req.url, 'http://x'), q = u.searchParams, route = `${req.method} ${u.pathname}`;
      let body = {};
      if (req.method === 'POST') { let s = ''; for await (const c of req) s += c; body = JSON.parse(s || '{}'); }
      const needDate = () => { if (!isRealDate(q.get('date'))) throw new Error('bad date'); return q.get('date'); };
      if (route === 'GET /') {
        const d = q.get('date') || clinic.now.slice(0, 10);
        const rows = bookingsForDate(db, d);
        const trs = rows.map((r) => `<tr><td>${r.time}</td><td>${clinic.doctors.find((x) => x.id === r.doctor_id)?.name}</td><td>${r.phone}</td></tr>`).join('');
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(`<h2>${clinic.clinic} - ${d}</h2><form><input type="date" name="date" value="${d}"><button>View</button></form><table border="1" cellpadding="5"><tr><th>Time</th><th>Doctor</th><th>Phone</th></tr>${trs || '<tr><td colspan="3">No bookings</td></tr>'}</table>`);
      }
      if (route === 'GET /slots') return send(200, freeSlots(clinic, db, q.get('doctor'), needDate()));
      if (route === 'GET /nearest') {
        const time = q.get('time') || '12:00';
        if (!isValidTime(time)) throw new Error('bad time');
        return send(200, nearestFreeSlots(clinic, db, { doctorId: q.get('doctor') || null, date: needDate(), time, limit: Math.min(Number(q.get('limit')) || 3, 10) }));
      }
      if (route === 'GET /day') return send(200, bookingsForDate(db, needDate()));
      if (route === 'GET /bookings') return send(200, myBookings(db, q.get('phone') || ''));
      if (route === 'POST /book') {
        if (typeof body.phone !== 'string' || !body.phone) throw new Error('phone required');
        const r = book(clinic, db, body);
        return send(r.ok ? 201 : r.reason === 'SLOT_TAKEN' ? 409 : 422, r);
      }
      if (route === 'POST /cancel') {
        if (typeof body.phone !== 'string' || !Number.isInteger(body.bookingId)) throw new Error('bad input');
        const r = cancel(db, body);
        return send(r.ok ? 200 : 404, r);
      }
      send(404, { ok: false, reason: 'NOT_FOUND' });
    } catch (e) { send(400, { ok: false, reason: 'BAD_REQUEST', detail: e.message }); }
  });
}
