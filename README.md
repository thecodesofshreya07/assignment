# Sunrise Dental - WhatsApp Booking (Five North Labs)

Built with Node.js 22.13+ using built-in `node:sqlite`. Zero npm dependencies needed (`npm install` is not required).

### Quick Start (under 2 minutes)

1. **Configure Environment** (Optional):
   Create a `.env` file in the project root with your Groq API key:
   ```env
   GROQ_API_KEY=your_key_here
   ```
   *(If omitted, it automatically falls back to the built-in rule-based mock parser).*

2. **Run tests** (verifies rules, parallel race conditions, and parser validation):
   ```bash
   npm test
   ```

3. **Evaluate the 15 messages**:
   ```bash
   npm run eval
   ```

4. **Receptionist view for a day**:
   ```bash
   npm run day -- 2026-11-18
   ```

5. **Run API server & receptionist web page** (visit http://localhost:3000):
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
