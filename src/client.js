// Tiny HTTP client so the decision code talks to the real API.
export function makeClient(base) {
  const j = async (p, o) => (await fetch(base + p, o)).json();
  const post = (p, b) => j(p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
  const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v != null)).toString();
  return {
    slots: (doctor, date) => j(`/slots?${qs({ doctor, date })}`),
    nearest: (o) => j(`/nearest?${qs(o)}`),
    book: (b) => post('/book', b),
    cancel: (b) => post('/cancel', b),
    mine: (phone) => j(`/bookings?${qs({ phone })}`),
    day: (date) => j(`/day?${qs({ date })}`),
  };
}
