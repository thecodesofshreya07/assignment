# Sunrise Dental - WhatsApp Booking (Five North Labs)

Built with Node.js 22.13+ using built-in `node:sqlite`. Zero npm dependencies needed (`npm install` is not required).

### Quick Start (under 2 minutes)

1. **Run tests** (verifies rules, parallel race conditions, and parser validation):
   ```bash
   npm test
   ```

2. **Evaluate the 15 messages**:
   - Using default mock parser (no API key needed):
     ```bash
     npm run eval
     ```
   - Using Groq LLM (`openai/gpt-oss-120b`):
     ```bash
     # Linux / macOS
     GROQ_API_KEY=your_key npm run eval

     # Windows PowerShell
     $env:GROQ_API_KEY="your_key"; npm run eval
     ```

3. **Receptionist view for a day**:
   ```bash
   npm run day -- 2026-11-18
   ```

4. **Run API server only**:
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
