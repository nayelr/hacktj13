# AI Voice Testing Platform

Flask app for testing business phone flows with the same caller persona across text, browser voice, and outbound phone calls:

- **Text chat:** Roleplay the business in the browser while the agent behaves like a customer/caller.
- **Voice conversation (web):** Connect via browser; you are the company, the ElevenLabs agent is the customer/caller. Uses your mic and speakers.
- **Outbound phone call:** Trigger an ElevenLabs + Twilio call to a real phone number with the same agent and context.
- **Caller controls:** Choose the ElevenLabs voice plus caller name, persona, tone, opening line, and speech tuning from the frontend.

## Setup

1. Create a virtual environment and install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Copy `.env.example` to `.env` and fill in the required values.

3. Run the app:

```bash
python app.py
```

4. Open [http://localhost:5000](http://localhost:5000).

## Required environment variables

- `FLASK_SECRET_KEY`: Flask session secret (optional for dev).
- `ELEVENLABS_API_KEY`: ElevenLabs API key (text chat, voice, and outbound calls).
- `ELEVENLABS_AGENT_ID`: ElevenLabs Conversational AI agent ID (required for both web voice conversation and phone calls).
- `ELEVENLABS_AGENT_PHONE_NUMBER_ID`: ElevenLabs phone number ID (Twilio) for outbound calling only.

## ElevenLabs phone setup

This app uses ElevenLabs' hosted outbound-call endpoint: `POST /v1/convai/twilio/outbound-call`.
The app also rewrites the configured ElevenLabs agent's prompt and first message to match the current business description and scenario, so use a dedicated agent for this project.

To make phone calls work:

1. In ElevenLabs, create or choose a Conversational AI agent.
2. Enable prompt overrides on that agent if you want the app to fully inject the business description and scenario at call time.
3. Import or connect a Twilio-backed phone number inside ElevenLabs, then copy the resulting phone number ID.
4. Put the agent ID and phone number ID into `.env`.

The app sends the business description and scenario through `conversation_initiation_client_data.conversation_config_override` so the phone call uses the same caller persona as the web voice conversation.

## Usage

### Text chat

1. Enter a business description and optional scenario.
2. Choose a voice and caller profile in **Caller Controls**.
3. Click **Save agent context**.
3. Use the text chat section to reply as the company. The page creates a text-only ElevenLabs conversation session behind the scenes.

### Voice conversation (web)

1. Enter a business description and optional scenario.
2. Choose a voice and caller profile in **Caller Controls**.
3. Click **Save agent context**.
4. Click **Connect & start speaking**. Allow microphone access.
5. Speak as the company; the ElevenLabs agent responds as the customer/caller.

### Outbound phone call

1. Enter the same business description and optional scenario.
2. Choose a voice and caller profile in **Caller Controls**.
3. Enter a destination phone number in E.164 format such as `+15551234567`.
4. Click `Start call`.

The backend calls ElevenLabs, which places the outbound phone call through its Twilio integration and uses the same caller prompt, caller profile, and voice settings as the text and voice experiences.
