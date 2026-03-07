# AI Voice Testing Platform

Flask app for testing business phone flows with the same AI caller in two modes:

- Web chat: roleplay the business while the agent behaves like a customer/caller.
- Outbound phone call: trigger an ElevenLabs + Twilio call to a real phone number using the same caller context.

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

- `FLASK_SECRET_KEY`: Flask session secret.
- `ELEVENLABS_API_KEY`: ElevenLabs API key for TTS and outbound calls.
- `OPENAI_API_KEY`: OpenAI key for the web chat agent.
- `ELEVENLABS_AGENT_ID`: ElevenLabs Conversational AI agent ID used for phone calls.
- `ELEVENLABS_AGENT_PHONE_NUMBER_ID`: ElevenLabs phone number ID connected to Twilio for outbound calling.

## ElevenLabs phone setup

This app uses ElevenLabs' hosted outbound-call endpoint: `POST /v1/convai/twilio/outbound-call`.

To make phone calls work:

1. In ElevenLabs, create or choose a Conversational AI agent.
2. Enable prompt overrides on that agent if you want the app to fully inject the business description and scenario at call time.
3. Import or connect a Twilio-backed phone number inside ElevenLabs, then copy the resulting phone number ID.
4. Put the agent ID and phone number ID into `.env`.

The app sends the business description and scenario through `conversation_initiation_client_data.conversation_config_override` so the phone call stays aligned with the same caller persona used in the web chat.

## Usage

### Web chat

1. Enter a business description.
2. Optionally enter a scenario such as `check appointment availability`.
3. Click `Start conversation`.
4. Reply as the business; the agent replies as the caller/customer and returns ElevenLabs audio.

### Outbound phone call

1. Enter the same business description and optional scenario.
2. Enter a destination phone number in E.164 format such as `+15551234567`.
3. Click `Start call`.

The backend calls ElevenLabs, which places the outbound phone call through its Twilio integration and uses the same caller prompt/scenario as the chat experience.
