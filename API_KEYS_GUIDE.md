# How to Obtain All API Keys – Voice Testing Platform

This guide walks you through getting every key you need for the app. Add each one to your `.env` file (one per line).

---

## Quick checklist

| Key | Required? | Where |
|-----|-----------|--------|
| **ELEVENLABS_API_KEY** | Yes | ElevenLabs → Profile → API keys |
| **ELEVENLABS_AGENT_ID** | Yes (for voice & calls) | ElevenLabs → Conversational AI → Agents |
| **FLASK_SECRET_KEY** | Optional | Generate in terminal |
| **ELEVENLABS_AGENT_PHONE_NUMBER_ID** | Only for phone calls | ElevenLabs → Phone numbers (after Twilio setup) |

---

## 1. ELEVENLABS_API_KEY (required)

**What it’s for:** Authenticates your app with ElevenLabs (voice, agents, and outbound calls).

**Steps:**

1. Open **https://elevenlabs.io** and sign up or log in.
2. Click your **profile icon** (top right) → **Profile + API key**,  
   or go directly to **https://elevenlabs.io/app/settings/api-keys**.
3. Click **“Create API key”**.
4. Give it a name (e.g. `hacktj`) and create it.
5. **Copy the key** (it looks like `sk_...`). You may only see it once.
6. In your project folder, open `.env` and add:
   ```env
   ELEVENLABS_API_KEY=sk_paste_your_key_here
   ```

**Note:** Free tier has a monthly character limit; enough for testing.

---

## 2. ELEVENLABS_AGENT_ID (required for voice conversation and phone calls)

**What it’s for:** Tells the app which ElevenLabs Conversational AI agent to use in the browser and on outbound calls.

**Steps:**

1. Stay logged in at **https://elevenlabs.io**.
2. In the left sidebar, open **Conversational AI** → **Agents**  
   (or go to **https://elevenlabs.io/app/conversational-ai**).
3. Either **create a new agent** or **open an existing one**.
4. Find the **Agent ID**:
   - In the agent’s **Settings** or **Overview**, or
   - In the browser URL when the agent is open (e.g. `.../agents/abc123XYZ...` — the part after `/agents/` is the Agent ID).
5. Copy that ID (e.g. `J3Pbu5gP6NNKBscdCdwB`).
6. In `.env` add:
   ```env
   ELEVENLABS_AGENT_ID=paste_agent_id_here
   ```

**Optional:** In the agent’s settings, enable **“Allow overrides”** (or similar) if you want the app to inject the business description and scenario per conversation.

---

## 3. FLASK_SECRET_KEY (optional)

**What it’s for:** Signs Flask sessions so your business description and scenario stay associated with your browser. If you skip it, the app uses a default (fine for local dev only).

**Steps:**

1. Open a terminal.
2. Run:
   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```
3. Copy the long hex string that’s printed.
4. In `.env` add:
   ```env
   FLASK_SECRET_KEY=paste_the_hex_string_here
   ```

---

## 4. ELEVENLABS_AGENT_PHONE_NUMBER_ID (only for “Start call” / phone testing)

**What it’s for:** Tells ElevenLabs which phone number to use as the caller when the app places an outbound call. You only need this if you use the **phone call** feature.

**Steps:**

1. **Twilio (if you don’t have a number yet):**
   - Go to **https://www.twilio.com** and sign up or log in.
   - In the Twilio Console, go to **Phone Numbers** → **Manage** → **Buy a number**.
   - Buy a number that supports voice (and note your Twilio Account SID and Auth Token if ElevenLabs asks for them).

2. **In ElevenLabs:**
   - Go to **https://elevenlabs.io** → **Conversational AI** → **Phone numbers** (or **Integrations** / **Twilio**).
   - Connect your Twilio account or add your Twilio number.
   - After the number is linked, ElevenLabs will show a **Phone number ID** (or similar) for that number. Copy it.

3. In `.env` add:
   ```env
   ELEVENLABS_AGENT_PHONE_NUMBER_ID=paste_phone_number_id_here
   ```

---

## Example `.env` files

**Minimum (web voice conversation only):**
```env
ELEVENLABS_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxxxxx
ELEVENLABS_AGENT_ID=abc123YourAgentId
```

**With optional session secret:**
```env
ELEVENLABS_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxxxxx
ELEVENLABS_AGENT_ID=abc123YourAgentId
FLASK_SECRET_KEY=your_64_char_hex_from_secrets_token_hex
```

**With phone calling:**
```env
ELEVENLABS_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxxxxx
ELEVENLABS_AGENT_ID=abc123YourAgentId
ELEVENLABS_AGENT_PHONE_NUMBER_ID=your_phone_number_id
FLASK_SECRET_KEY=optional_hex_here
```

---

## Security

- **Do not commit `.env`** or share these values. `.env` is listed in `.gitignore`.
- Rotate keys if you think they were exposed.
- In production, use a strong `FLASK_SECRET_KEY` and keep all keys in a secure secrets manager.
