import { allSlotsForDay, checkSlotRules, addDays, nowLocal } from './slots.js';
import {
  tryInsertBooking,
  bookedTimes,
  activeBookingsForPhone,
  cancelOwnBooking,
} from './db.js';

export function freeSlots(clinic, db, doctorId, date) {
  const taken = new Set(bookedTimes(db, doctorId, date));
  return allSlotsForDay(clinic, doctorId, date).filter(
    (t) => !taken.has(t) && checkSlotRules(clinic, doctorId, date, t).ok
  );
}

export function book(clinic, db, { doctorId, date, time, phone }) {
  const rules = checkSlotRules(clinic, doctorId, date, time);
  if (!rules.ok) return rules;
  const created = tryInsertBooking(db, { doctorId, date, time, phone }, clinic.now);
  if (!created.ok) return created;
  return { ok: true, booking: { id: created.id, doctorId, date, time, phone } };
}

export function cancel(db, { bookingId, phone }) {
  const done = cancelOwnBooking(db, bookingId, phone);
  return done ? { ok: true } : { ok: false, reason: 'no booking found for this phone number' };
}

export function myBookings(db, phone) {
  return activeBookingsForPhone(db, phone);
}

export function nearestFreeSlots(clinic, db, { doctorId = null, date, time = '12:00', limit = 3, daysAhead = 7 }) {
  const doctorIds = doctorId ? [doctorId] : clinic.doctors.map((d) => d.id);
  const target = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const out = [];
  for (let i = 0; i <= daysAhead && out.length < limit; i++) {
    const day = addDays(date, i);
    if (day < nowLocal(clinic).date) continue;
    const dayOptions = [];
    for (const id of doctorIds) {
      for (const t of freeSlots(clinic, db, id, day)) {
        const m = Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
        dayOptions.push({ doctorId: id, date: day, time: t, dist: Math.abs(m - target) });
      }
    }
    dayOptions.sort((a, b) => a.dist - b.dist || a.time.localeCompare(b.time));
    for (const o of dayOptions) {
      if (out.length < limit) out.push({ doctorId: o.doctorId, date: o.date, time: o.time });
    }
  }
  return out;
}
