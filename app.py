"""
AI Voice Testing Platform - Conversational Agent
ElevenLabs for speech; OpenAI for conversation (agent talks to you as if you're the company).
"""
import base64
import json
import os
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from flask import Flask, Response, jsonify, render_template, request, session
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-change-in-production")

ELEVENLABS_API_BASE = os.getenv("ELEVENLABS_API_BASE", "https://api.elevenlabs.io").rstrip("/")
DEFAULT_PHONE_SCENARIO = (
    "check availability, complete a typical customer task, and avoid speaking to a human if possible"
)
E164_PATTERN = re.compile(r"^\+[1-9]\d{7,14}$")


def get_elevenlabs_client():
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        return None
    try:
        from elevenlabs.client import ElevenLabs
    except ImportError:
        try:
            from elevenlabs import ElevenLabs
        except ImportError:
            return None
    return ElevenLabs(api_key=api_key)


def collect_audio_bytes(audio_stream):
    if audio_stream is None:
        return None
    if isinstance(audio_stream, (bytes, bytearray)):
        return bytes(audio_stream)
    if isinstance(audio_stream, str):
        return audio_stream.encode("utf-8")
    if hasattr(audio_stream, "__iter__"):
        return b"".join(chunk for chunk in audio_stream if chunk)
    return audio_stream


def get_session_value(key: str, default: str = ""):
    return (session.get(key) or default).strip()


def build_caller_prompt(business_description: str, scenario: str):
    return (
        "You are simulating a real customer contacting the business below. "
        "The other side is the company, an operator, or an IVR. "
        "Stay in character as the caller/customer, try to complete the task, "
        "and avoid escalating to a human unless the flow requires it.\n\n"
        f"Business description:\n{business_description}\n\n"
        f"Caller goal:\n{scenario}\n\n"
        "Speak naturally, ask one thing at a time, and keep each response concise."
    )


def build_first_message(scenario: str):
    return f"Hi, I'm calling because I'd like to {scenario.rstrip('.')}."


def build_conversation_initiation_data(business_description: str, scenario: str):
    return {
        "conversation_config_override": {
            "agent": {
                "prompt": {
                    "prompt": build_caller_prompt(business_description, scenario),
                },
                "first_message": build_first_message(scenario),
            }
        }
    }


def normalize_scenario(value: str):
    scenario = (value or "").strip()
    return scenario or DEFAULT_PHONE_SCENARIO


def validate_phone_number(phone_number: str):
    return bool(E164_PATTERN.match((phone_number or "").strip()))


def elevenlabs_post(path: str, payload: dict):
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise RuntimeError("ELEVENLABS_API_KEY not set in .env")

    request_body = json.dumps(payload).encode("utf-8")
    api_request = Request(
        f"{ELEVENLABS_API_BASE}{path}",
        data=request_body,
        headers={
            "Content-Type": "application/json",
            "xi-api-key": api_key,
        },
        method="POST",
    )

    try:
        with urlopen(api_request, timeout=30) as response:
            raw_body = response.read().decode("utf-8")
            return json.loads(raw_body) if raw_body else {}
    except HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        try:
            parsed_body = json.loads(error_body)
        except json.JSONDecodeError:
            parsed_body = {"error": error_body or exc.reason}
        error_message = parsed_body.get("detail") or parsed_body.get("error") or exc.reason
        raise RuntimeError(f"ElevenLabs API error ({exc.code}): {error_message}") from exc
    except URLError as exc:
        raise RuntimeError(f"Could not reach ElevenLabs: {exc.reason}") from exc


def text_to_speech_audio(text: str):
    """Return MP3 bytes from ElevenLabs TTS."""
    client = get_elevenlabs_client()
    if not client:
        return None
    audio_stream = client.text_to_speech.convert(
        text=text[:1500],
        voice_id="JBFqnCBsd6RMkjVDRZzb",
        model_id="eleven_turbo_v2_5",
    )
    return collect_audio_bytes(audio_stream)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/tts", methods=["POST"])
def tts():
    """Convert text to speech (standalone)."""
    text = request.json.get("text", "") if request.is_json else request.form.get("text", "")
    if not text:
        return jsonify({"error": "No text provided"}), 400
    try:
        audio = text_to_speech_audio(text)
        if audio is None:
            return jsonify({"error": "ELEVENLABS_API_KEY not set in .env"}), 500
        return Response(
            audio,
            mimetype="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=speech.mp3"},
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/context", methods=["POST"])
def set_context():
    """Set business description and start conversation."""
    data = request.get_json() or {}
    description = (data.get("description") or "").strip()
    scenario = normalize_scenario(data.get("scenario"))
    if not description:
        return jsonify({"error": "No description provided"}), 400
    session["business_description"] = description
    session["scenario"] = scenario
    session["messages"] = []
    return jsonify({"ok": True, "scenario": scenario})


@app.route("/api/chat", methods=["POST"])
def chat():
    """Send a message; agent replies as if talking to the company. Returns text + base64 audio."""
    business_description = get_session_value("business_description")
    scenario = normalize_scenario(get_session_value("scenario"))
    if not business_description:
        return jsonify({"error": "Set a business description first (use /api/context)"}), 400

    data = request.get_json() or {}
    user_message = (data.get("message") or "").strip()
    if not user_message:
        return jsonify({"error": "No message provided"}), 400

    messages = session.get("messages", [])
    system_prompt = build_caller_prompt(business_description, scenario)
    if not messages:
        messages = [{"role": "system", "content": system_prompt}]
    messages.append({"role": "user", "content": user_message})

    openai_key = os.getenv("OPENAI_API_KEY")
    if not openai_key:
        agent_text = "I'd like to know more about your business. (Set OPENAI_API_KEY in .env for full conversation.)"
    else:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_key)
            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
            )
            agent_text = (completion.choices[0].message.content or "").strip()
        except Exception as e:
            agent_text = f"I had trouble responding: {e}"

    messages.append({"role": "assistant", "content": agent_text})
    session["messages"] = messages

    audio_base64 = None
    try:
        audio_bytes = text_to_speech_audio(agent_text)
        if audio_bytes:
            audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
    except Exception:
        pass

    return jsonify({"text": agent_text, "audio_base64": audio_base64})


@app.route("/api/call", methods=["POST"])
def start_call():
    """Start an outbound phone call through ElevenLabs + Twilio."""
    data = request.get_json() or {}
    to_number = (data.get("to_number") or "").strip()
    business_description = (data.get("business_description") or get_session_value("business_description")).strip()
    scenario = normalize_scenario(data.get("scenario") or get_session_value("scenario"))

    if not business_description:
        return jsonify({"error": "Provide a business description first."}), 400
    if not validate_phone_number(to_number):
        return jsonify({"error": "Phone number must be in E.164 format, for example +15551234567."}), 400

    missing_env = [
        name
        for name in ("ELEVENLABS_API_KEY", "ELEVENLABS_AGENT_ID", "ELEVENLABS_AGENT_PHONE_NUMBER_ID")
        if not os.getenv(name)
    ]
    if missing_env:
        return jsonify({"error": f"Missing required environment variables: {', '.join(missing_env)}"}), 500

    payload = {
        "agent_id": os.getenv("ELEVENLABS_AGENT_ID"),
        "agent_phone_number_id": os.getenv("ELEVENLABS_AGENT_PHONE_NUMBER_ID"),
        "to_number": to_number,
        "conversation_initiation_client_data": build_conversation_initiation_data(
            business_description,
            scenario,
        ),
    }

    try:
        call_response = elevenlabs_post("/v1/convai/twilio/outbound-call", payload)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 502

    return jsonify(
        {
            "ok": True,
            "status": call_response.get("status", "initiated"),
            "message": "Call initiated.",
            "to_number": to_number,
            "scenario": scenario,
            "call_sid": call_response.get("call_sid") or call_response.get("callSid"),
            "conversation_id": call_response.get("conversation_id") or call_response.get("conversationId"),
            "raw": call_response,
        }
    )


if __name__ == "__main__":
    app.run(debug=True, port=5000)
