# Sunrise Dental - WhatsApp Booking
**Run tests** (verifies rules, parallel race conditions, and parser validation):
   ```bash
   npm test
   ```

**Evaluate the 15 messages**:
   ```bash
   npm run eval or $env:PARSER="mock"; npm run eval; $env:PARSER=""
   ```

 **Receptionist view for a day**:
   ```bash
   npm run day -- 2026-11-18
   ```

**Run API server & receptionist web page** (visit http://localhost:3000):
   ```bash
   npm start
   ``` 

### Project Architecture
- `src/slots.js`: Business rules (working hours, 30-min grid, closed dates, past dates, fixed `now`).
- `src/db.js`: SQLite schema with partial unique index `(doctor_id, date, time) WHERE status = 'booked'` preventing race-condition double bookings.
- `src/service.js`: Slot availability, atomic booking, and phone-verified cancellation.
- `src/server.js`: HTTP endpoints (`/slots`, `/nearest`, `/book`, `/cancel`, `/day`, `/bookings`).
- `src/understand.js`: LLM extraction (Groq / Anthropic / Gemini / rule mock) + strict schema validation + retry with exponential backoff.
- `src/decide.js`: Deterministic decision logic (book, cancel, refuse, ask) + friendly WhatsApp replies with alternatives.
- `src/run.js`: Concurrency-aware evaluation runner that scores wrong bookings, needless questions, and correct outcomes.
- `NOTE.md`: One-page explanation answering all 5 core evaluation questions.
