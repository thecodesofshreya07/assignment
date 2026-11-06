const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const toMinutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const fromMinutes = (m) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function isRealDate(date) {
  if (typeof date !== 'string' || !DATE_RE.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isValidTime(time) {
  return typeof time === 'string' && TIME_RE.test(time);
}

export function weekdayKey(date) {
  const [y, m, d] = date.split('-').map(Number);
  return DAY_KEYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

// "now" comes from clinic.json (fixed), never from the real clock.
export function nowLocal(clinic) {
  // "2026-11-16T10:00:00+05:30" -> { date: "2026-11-16", time: "10:00" }
  return { date: clinic.now.slice(0, 10), time: clinic.now.slice(11, 16) };
}

export function getDoctor(clinic, doctorId) {
  return clinic.doctors.find((d) => d.id === doctorId) || null;
}

// All valid slot start times ("HH:MM") for one doctor on one date,
// ignoring bookings and the past. A slot must fit fully inside a window.
export function allSlotsForDay(clinic, doctorId, date) {
  const doctor = getDoctor(clinic, doctorId);
  if (!doctor || !isRealDate(date)) return [];
  if (clinic.closed_dates.includes(date)) return [];
  const windows = doctor.hours[weekdayKey(date)] || [];
  const step = clinic.slot_minutes;
  const slots = [];
  for (const w of windows) {
    const [start, end] = w.split('-').map(toMinutes);
    for (let t = start; t + step <= end; t += step) slots.push(fromMinutes(t));
  }
  return slots;
}

export function isPast(clinic, date, time) {
  const now = nowLocal(clinic);
  // A slot that starts exactly "now" is also treated as unbookable.
  return date < now.date || (date === now.date && time <= now.time);
}

// Single place that answers: "is this (doctor, date, time) a bookable slot
// according to clinic rules?" Booking state (taken or not) is checked
// separately, atomically, by the database.
export function checkSlotRules(clinic, doctorId, date, time) {
  if (!getDoctor(clinic, doctorId)) return { ok: false, reason: 'UNKNOWN_DOCTOR' };
  if (!isRealDate(date) || !isValidTime(time)) return { ok: false, reason: 'BAD_INPUT' };
  if (clinic.closed_dates.includes(date)) return { ok: false, reason: 'CLOSED_DATE' };
  const windows = getDoctor(clinic, doctorId).hours[weekdayKey(date)] || [];
  if (windows.length === 0) return { ok: false, reason: 'DOCTOR_NOT_WORKING' };
  if (!allSlotsForDay(clinic, doctorId, date).includes(time)) {
    return { ok: false, reason: 'OUTSIDE_HOURS_OR_OFF_GRID' };
  }
  if (isPast(clinic, date, time)) return { ok: false, reason: 'IN_THE_PAST' };
  return { ok: true };
}
