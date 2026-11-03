import { nowLocal } from './slots.js';

// CODE decides what happens; the AI output is just validated input.
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const drName = (c, id) => c.doctors.find((d) => d.id === id)?.name ?? id;

export function fmt(c, { doctorId, date, time }) {
  const [y, m, d] = date.split('-').map(Number);
  let s = `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MON[m - 1]}`;
  if (time) { const [h, mi] = time.split(':').map(Number); s += `, ${h % 12 || 12}:${String(mi).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; }
  return doctorId ? `${s} with ${drName(c, doctorId)}` : s;
}
const list = (c, xs) => xs.map((x) => '- ' + fmt(c, x)).join('\n');
const R = (action, reply, extra = {}) => ({ action, reply, ...extra });

export async function decide(api, clinic, msg, u) {
  const today = nowLocal(clinic).date, phone = msg.from;
  if (!u.ok) return R('ask', "Sorry, I couldn't understand that. Which day, time and doctor would you like?");
  const p = u.parsed;
  const ids = p.doctor ? [p.doctor] : clinic.doctors.map((d) => d.id);
  const near = async (date, time) => { // up to 3 REAL free slots near the request
    const seen = new Set(), out = [];
    const lists = [];
    if (p.doctor) lists.push(await api.nearest({ doctor: p.doctor, date, time, limit: 2 }));
    lists.push(await api.nearest({ date, time, limit: 3 }));
    for (const s of lists.flat()) { const k = `${s.doctorId}${s.date}${s.time}`; if (!seen.has(k) && out.length < 3) { seen.add(k); out.push(s); } }
    return out;
  };

  if (p.intent === 'other')
    return R('ask', 'Hi! I can book or cancel dental appointments. Which day and time would you like, and with Dr. Rao or Dr. Iyer?');

  if (p.intent === 'cancel') {
    const mine = (await api.mine(phone)).filter((b) => (!p.date || b.date === p.date) && (!p.time || b.time === p.time) && (!p.doctor || b.doctor_id === p.doctor));
    const as = (b) => ({ doctorId: b.doctor_id, date: b.date, time: b.time });
    if (mine.length === 0) return R('refuse', "I couldn't find an active booking under this phone number, so I can't cancel anything. I can only cancel bookings made from your own number.");
    if (mine.length > 1) return R('ask', `You have several bookings. Which one should I cancel?\n${list(clinic, mine.map(as))}`);
    const r = await api.cancel({ bookingId: mine[0].id, phone });
    return r.ok ? R('cancel', `Cancelled: ${fmt(clinic, as(mine[0]))}.`, { cancelled: mine[0].id }) : R('refuse', "Sorry, I couldn't cancel that booking.");
  }

  if (!p.date) {
    const alts = await api.nearest({ date: today, time: p.time || '10:00', limit: 3 });
    return R('ask', `Which day works for you? Earliest free slots:\n${list(clinic, alts)}\nReply with the one you want.`);
  }
  if (!p.time) {
    const free = [];
    for (const id of ids) for (const t of await api.slots(id, p.date)) free.push({ doctorId: id, date: p.date, time: t });
    if (!free.length) return R('refuse', `Sorry, ${p.doctor ? drName(clinic, p.doctor) : 'we'} ${p.doctor ? "isn't" : "aren't"} available on ${fmt(clinic, { date: p.date })}. Nearest options:\n${list(clinic, await near(p.date, '12:00'))}`);
    free.sort((a, b) => a.time.localeCompare(b.time));
    return R('ask', `What time on ${fmt(clinic, { date: p.date })}? Free slots:\n${list(clinic, free.slice(0, 6))}`);
  }
  const open = [];
  for (const id of ids) if ((await api.slots(id, p.date)).includes(p.time)) open.push(id);
  const sorry = async () => R('refuse', `Sorry, ${fmt(clinic, { date: p.date, time: p.time, doctorId: p.doctor })} isn't available. Nearest free slots:\n${list(clinic, await near(p.date, p.time))}\nReply with the one you want.`);
  if (open.length === 0) return sorry();
  if (open.length > 1) return R('ask', `Both doctors are free at ${fmt(clinic, { date: p.date, time: p.time })}. Dr. Rao or Dr. Iyer?`);
  const slot = { doctorId: open[0], date: p.date, time: p.time };
  const r = await api.book({ ...slot, phone });
  return r.ok ? R('book', `Booked: ${fmt(clinic, slot)}. Reply "cancel" to cancel.`, { booking: slot }) : sorry();
}
