# How to Configure Your ElevenLabs Agent (CallPenTest)

Use this so your agent works with the Voice Testing Platform. You’re already in the right place: **Agent** tab for **CallPenTest**.

---

## 1. System prompt

**Where:** Agent tab → **System prompt** (main text box).

**What to put:** A default “caller” persona. The app will often override this with the business description and scenario, but the dashboard prompt is used when overrides aren’t sent or as a fallback.

**Suggested text:**

```
You are a customer or caller contacting a business. The person you're talking to is the company (receptionist, IVR, or staff). Stay in character as the caller. Try to complete your task (e.g. check an appointment, ask about pricing) and keep replies concise. Speak naturally, one or two sentences at a time.
```

Replace the current “You are a helpful assistant.” with something like the above (or keep it short and let the app’s overrides do the work).

---

## 2. First message

**Where:** Agent tab → **First message**.

**What to put:** A generic opener the agent says when a conversation starts. The app can override this per conversation with something like “Hi, I’m calling because I’d like to check my appointment.”

**Suggested text:**

```
Hi, I'm calling to get some help today.
```

You can leave “Hello! How can I help you today?” if you prefer; the app will often replace it via overrides.

---

## 3. Enable overrides (required for the app)

**Where:** Click the **Security** tab (top bar, next to Agent, Workflow, etc.).

**What to do:**

- Find the option for **prompt overrides**, **conversation overrides**, or **allow client overrides** (wording may vary).
- Turn it **on** so the app can send `conversation_config_override` with the business description and scenario.

Without this, the app cannot inject the business context and scenario; the agent will only use the dashboard prompt.

---

## 4. Voice, language, LLM

- **Voice:** Any voice you like (e.g. keep “Eric - Smooth, Trustworthy Primary”). The app doesn’t change this.
- **Language:** Keep **English** (or add others if you need them).
- **LLM:** **Gemini 2.5 Flash** (or any non-OpenAI model) is fine. The app doesn’t care which provider you pick here.

---

## 5. Get your Agent ID

**Where:** While editing the agent, check:

- The **URL** in the browser (e.g. `.../agents/abc123XYZ...`). The part after `/agents/` is the Agent ID, or  
- **Settings** or **Overview** for the agent, if the ID is shown there.

Copy that ID into your `.env`:

```env
ELEVENLABS_AGENT_ID=your_agent_id_here
```

---

## Quick checklist

| Step | Where | Action |
|------|--------|--------|
| 1 | Agent tab → System prompt | Set a default “caller” prompt (see above). |
| 2 | Agent tab → First message | Set a short opener (or leave default). |
| 3 | **Security** tab | Enable prompt/conversation overrides. |
| 4 | Agent tab | Leave Voice, Language, LLM as you like (e.g. Gemini). |
| 5 | URL or agent settings | Copy Agent ID → `.env` as `ELEVENLABS_AGENT_ID`. |

After this, run your app: set a business description and scenario, then use **Start voice conversation** → **Connect & start speaking**. The agent will use your dashboard defaults and the app’s overrides for each conversation.
