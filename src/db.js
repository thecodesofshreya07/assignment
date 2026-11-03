import { DatabaseSync } from 'node:sqlite'; // built in (Node 22.13+), zero dependencies

export function openDb(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id  TEXT NOT NULL,
      date       TEXT NOT NULL,
      time       TEXT NOT NULL,
      phone      TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','cancelled')),
      created_at TEXT NOT NULL
    );
    -- THIS is what prevents double bookings: the database itself refuses a
    -- second ACTIVE booking for the same doctor+date+time. Cancelled rows
    -- do not count, so a cancelled slot can be booked again.
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_booking_per_slot
      ON bookings (doctor_id, date, time) WHERE status = 'booked';
  `);
  return db;
}

export function tryInsertBooking(db, { doctorId, date, time, phone }, createdAt) {
  try {
    const info = db
      .prepare(
        'INSERT INTO bookings (doctor_id, date, time, phone, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(doctorId, date, time, phone, createdAt);
    return { ok: true, id: Number(info.lastInsertRowid) };
  } catch (err) {
    if (err.errcode === 2067 || /UNIQUE constraint/.test(err.message)) return { ok: false, reason: 'SLOT_TAKEN' };
    throw err; // anything else is a real bug, do not hide it
  }
}

export function bookedTimes(db, doctorId, date) {
  return db
    .prepare("SELECT time FROM bookings WHERE doctor_id=? AND date=? AND status='booked'")
    .all(doctorId, date)
    .map((r) => r.time);
}

export function activeBookingsForPhone(db, phone) {
  return db
    .prepare(
      "SELECT id, doctor_id, date, time FROM bookings WHERE phone=? AND status='booked' ORDER BY date, time"
    )
    .all(phone);
}

export function bookingsForDate(db, date) {
  return db
    .prepare(
      "SELECT id, doctor_id, time, phone FROM bookings WHERE date=? AND status='booked' ORDER BY time, doctor_id"
    )
    .all(date);
}

// Cancel only if the booking belongs to this phone number. One atomic UPDATE,
// so ownership check and cancellation cannot be separated.
export function cancelOwnBooking(db, id, phone) {
  const info = db
    .prepare("UPDATE bookings SET status='cancelled' WHERE id=? AND phone=? AND status='booked'")
    .run(id, phone);
  return info.changes === 1;
}
