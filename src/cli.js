// Receptionist view:  node src/cli.js [YYYY-MM-DD]   (default: clinic "today")
import { readFileSync } from 'node:fs';
import { openDb, bookingsForDate } from './db.js';
import { nowLocal } from './slots.js';
const clinic = JSON.parse(readFileSync(new URL('../data/clinic.json', import.meta.url)));
const date = process.argv[2] || nowLocal(clinic).date;
const rows = bookingsForDate(openDb(process.env.DB_PATH || 'bookings.db'), date);
console.log(`${clinic.clinic} - appointments on ${date}`);
if (!rows.length) console.log('(none)');
for (const r of rows) console.log(`${r.time}  ${clinic.doctors.find((d) => d.id === r.doctor_id).name.padEnd(9)} ${r.phone}`);
