# AI Voice Testing Platform

Flask app for testing business phone flows with browser voice and outbound phone calls.

- Voice conversation (web): You are the company, the ElevenLabs agent is the caller/customer.
- Batch outbound phone test: Run 1-10 calls one-by-one across a task list.
- Task suggestion: Generate a starter task list from the business summary.
- Post-call analysis report: Detect edge cases/issues from transcript + call telemetry.

## Setup

1. Create a virtual environment and install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Copy `.env.example` to `.env` and fill in values.
3. Run Flask API:

```bash
python app.py
```

4. In another terminal, run Next frontend:

```bash
cd frontend
npm install
npm run dev
```

5. Open `http://localhost:3000` (CalPen/Giga UI in `frontend/src`).

Flask `/` now redirects to `FRONTEND_URL` by default. You can change this with:
- `FRONTEND_URL` (default `http://localhost:3000`)
- `ENABLE_FRONTEND_REDIRECT` (default `1`)

## Required environment variables

- `FLASK_SECRET_KEY`: Flask session secret (optional for dev).
- `ELEVENLABS_API_KEY`: ElevenLabs API key (voice and outbound calls).
- `ELEVENLABS_AGENT_ID`: ElevenLabs Conversational AI agent ID.
- `ELEVENLABS_AGENT_PHONE_NUMBER_ID`: ElevenLabs phone number ID (Twilio) for outbound calls.
- `OPENAI_API_KEY` (optional): Enables comprehensive transcript analysis report per call.
- `OPENAI_ANALYSIS_MODEL` (optional): Defaults to `gpt-5-nano` for low-cost, high-context analysis.

## Usage

### Voice conversation (web)

1. Enter business summary (required) and optional website.
2. Click **Save agent context**.
3. Click **Connect and start speaking** and allow microphone access.

### Batch outbound phone test

1. Enter business summary (required) and optional website.
2. Enter task list (one task per line) or click **Suggest tasks from summary**.
3. Set number of test agents between 1 and 10.
4. Enter destination US phone number (`5551234567` or `+15551234567`).
5. Click **Run batch test**.

Batch mode places calls sequentially: the next call starts only after the previous call finishes (or times out while waiting for status).
If `OPENAI_API_KEY` is set, each call also includes an AI analysis report with outcome, detected issues, edge cases, and recommendations.
