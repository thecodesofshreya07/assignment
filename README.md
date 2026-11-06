# Sunrise Dental: WhatsApp Booking

An AI reads the patient's WhatsApp message. The code enforces the clinic rules and makes the booking.

## Run it in 5 minutes

Needs Node.js 22 or newer.

1. Install:
   ```bash
   npm install
   ```

2. Run the 15 messages. With **no API key**, the project uses a **rules-based mock parser** (it is not an AI model):
   ```bash
   npm run eval
   ```
   To force the mock even when a key is set:
   - Windows PowerShell: `$env:PARSER="mock"; npm run eval; $env:PARSER=""`
   - Mac / Linux: `PARSER=mock npm run eval`

3. To use the real AI model (Groq), create a file named `.env` in the project folder:
   ```
   GROQ_API_KEY=your_key_here
   ```
   Then run `npm run eval` again. The first line of the output says which parser is used (`Parser: groq API` or the mock). No API key is included in this repo.

`npm run eval` prints each message with the reply the patient would get, then three numbers: wrong bookings (including double bookings), needless questions, and messages handled correctly.

## Other commands

**Tests** (rules, parallel race conditions, parser validation):
```bash
npm test
```

**Receptionist view for a day** (run after `npm run eval`):
```bash
npm run day -- 2026-11-18
```

**API server and receptionist web page** (open http://localhost:3000):
```bash
npm start
```

## Project architecture
- `src/slots.js`: Business rules (working hours, 30-min grid, closed dates, past dates, fixed `now`).
- `src/db.js`: SQLite schema with partial unique index `(doctor_id, date, time) WHERE status = 'booked'`, which prevents double bookings.
- `src/service.js`: Slot availability, atomic booking, and phone-verified cancellation.
- `src/server.js`: HTTP endpoints (`/slots`, `/nearest`, `/book`, `/cancel`, `/day`, `/bookings`).
- `src/understand.js`: LLM extraction (Groq / Anthropic / Gemini / rule mock), strict schema validation, and retry with exponential backoff.
- `src/decide.js`: Decision logic (book, cancel, refuse, ask) and WhatsApp replies with alternatives.
- `src/run.js`: Evaluation runner that scores wrong bookings, needless questions, and correct outcomes. m09 and m10 are sent at the same time.
- `data/`: `clinic.json`, `messages.json`, and my expected outcome for each message.
- `NOTE.md`: One-page note answering the five questions.