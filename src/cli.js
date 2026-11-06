//Receptionist view
import { readFileSync } from 'node:fs';
import { openDb, bookingsForDate } from './db.js';
import { nowLocal } from './slots.js';
const clinic = JSON.parse(readFileSync(new URL('../data/clinic.json', import.meta.url)));
const date = process.argv[2] || nowLocal(clinic).date;
const rows = bookingsForDate(openDb('bookings.db'), date);
db.close();
console.log(`${clinic.clinic} - appointments on ${date}`);
if (!rows.length) console.log('(none)');
for (const r of rows) console.log(`${r.time}  ${clinic.doctors.find((d) => d.id === r.doctor_id).name.padEnd(9)} ${r.phone}`);
