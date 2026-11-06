import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { allSlotsForDay, checkSlotRules, weekdayKey } from '../src/slots.js';
import { openDb } from '../src/db.js';
import { book, cancel, freeSlots, nearestFreeSlots } from '../src/service.js';
////contains automated tests
const clinic = JSON.parse(readFileSync(new URL('../data/clinic.json', import.meta.url)));

test('weekday of fixed "now" (16 Nov 2026) is Monday', () => {
  assert.equal(weekdayKey('2026-11-16'), 'mon');
});

test('Rao works Saturday morning only, Iyer never on Saturday', () => {
  assert.deepEqual(allSlotsForDay(clinic, 'rao', '2026-11-21'), ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30']);
  assert.deepEqual(allSlotsForDay(clinic, 'iyer', '2026-11-21'), []);
});

test('closed date has no slots (Fri 20 Nov)', () => {
  assert.deepEqual(allSlotsForDay(clinic, 'rao', '2026-11-20'), []);
  assert.equal(checkSlotRules(clinic, 'rao', '2026-11-20', '11:00').reason, 'CLOSED_DATE');
});

test('last Rao evening slot is 19:30; 19:45 is rejected (m06)', () => {
  const slots = allSlotsForDay(clinic, 'rao', '2026-11-18');
  assert.ok(slots.includes('19:30'));
  assert.ok(!slots.includes('19:45'));
  assert.equal(checkSlotRules(clinic, 'rao', '2026-11-18', '19:45').ok, false);
});

test('Iyer: 15:00 ok, 17:00 not (day ends at 17:00)', () => {
  assert.equal(checkSlotRules(clinic, 'iyer', '2026-11-19', '15:00').ok, true);
  assert.equal(checkSlotRules(clinic, 'iyer', '2026-11-19', '17:00').ok, false);
});

test('past and "right now" slots are rejected (m08 and slot at now)', () => {
  assert.equal(checkSlotRules(clinic, 'rao', '2026-11-16', '09:00').ok, false);
  assert.equal(checkSlotRules(clinic, 'rao', '2026-11-16', '10:00').reason, 'IN_THE_PAST');
  assert.equal(checkSlotRules(clinic, 'rao', '2026-11-16', '10:30').ok, true);
});

test('bad input never throws or books', () => {
  assert.equal(checkSlotRules(clinic, 'nobody', '2026-11-17', '11:00').reason, 'UNKNOWN_DOCTOR');
  assert.equal(checkSlotRules(clinic, 'rao', '2026-02-30', '11:00').reason, 'BAD_INPUT');
  assert.equal(checkSlotRules(clinic, 'rao', '2026-11-17', '25:99').reason, 'BAD_INPUT');
  assert.equal(checkSlotRules(clinic, 'rao', null, undefined).reason, 'BAD_INPUT');
});

test('second booking for the same slot is refused by the database', () => {
  const db = openDb();
  const a = book(clinic, db, { doctorId: 'rao', date: '2026-11-18', time: '12:00', phone: '+1' });
  const b = book(clinic, db, { doctorId: 'rao', date: '2026-11-18', time: '12:00', phone: '+2' });
  assert.equal(a.ok, true);
  assert.equal(b.ok, false);
  assert.equal(b.reason, 'SLOT_TAKEN');
});

test('cancel: only the owner can cancel, and the slot frees up', () => {
  const db = openDb();
  const a = book(clinic, db, { doctorId: 'rao', date: '2026-11-17', time: '18:00', phone: '+2' });
  assert.equal(cancel(db, { bookingId: a.booking.id, phone: '+99' }).ok, false); // stranger
  assert.equal(freeSlots(clinic, db, 'rao', '2026-11-17').includes('18:00'), false);
  assert.equal(cancel(db, { bookingId: a.booking.id, phone: '+2' }).ok, true); // owner
  assert.equal(freeSlots(clinic, db, 'rao', '2026-11-17').includes('18:00'), true);
  const again = book(clinic, db, { doctorId: 'rao', date: '2026-11-17', time: '18:00', phone: '+3' });
  assert.equal(again.ok, true);
});

test('nearest free slots only returns real, bookable slots', () => {
  const db = openDb();
  book(clinic, db, { doctorId: 'rao', date: '2026-11-18', time: '12:00', phone: '+1' });
  const alt = nearestFreeSlots(clinic, db, { doctorId: 'rao', date: '2026-11-18', time: '12:00' });
  assert.equal(alt.length, 3);
  for (const s of alt) {
    assert.equal(checkSlotRules(clinic, s.doctorId, s.date, s.time).ok, true);
    assert.ok(!(s.doctorId === 'rao' && s.date === '2026-11-18' && s.time === '12:00'));
  }
});
