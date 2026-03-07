"""
AI Voice Testing Platform - Conversational Agent
Uses ElevenLabs agents for browser chat, browser voice, and outbound phone calls.
"""
import json
import os
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
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
DEFAULT_CALLER_PERSONA = "A practical customer who wants to complete a real task efficiently."
DEFAULT_CALLER_TONE = "friendly, calm, and persistent"
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


def legacy_text_to_speech_audio(text: str):
    try:
        from elevenlabs import generate
    except ImportError:
        return None
    return generate(
        text=text[:1500],
        api_key=os.getenv("ELEVENLABS_API_KEY"),
        voice="JBFqnCBsd6RMkjVDRZzb",
        model="eleven_turbo_v2_5",
        stream=False,
    )


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


def parse_bounded_float(value, minimum: float, maximum: float, fallback=None):
    if value in (None, ""):
        return fallback
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return fallback
    return max(minimum, min(maximum, parsed))


def normalize_caller_settings(data: dict = None):
    data = data or {}
    return {
        "caller_name": (data.get("caller_name") or "").strip(),
        "caller_persona": (data.get("caller_persona") or DEFAULT_CALLER_PERSONA).strip(),
        "caller_tone": (data.get("caller_tone") or DEFAULT_CALLER_TONE).strip(),
        "additional_instructions": (data.get("additional_instructions") or "").strip(),
        "opening_line": (data.get("opening_line") or "").strip(),
        "voice_id": (data.get("voice_id") or "").strip(),
        "stability": parse_bounded_float(data.get("stability"), 0.0, 1.0),
        "speed": parse_bounded_float(data.get("speed"), 0.7, 1.2),
        "similarity_boost": parse_bounded_float(data.get("similarity_boost"), 0.0, 1.0),
    }


def get_session_caller_settings():
    return normalize_caller_settings(session.get("caller_settings") or {})


def resolve_caller_settings(request_data: dict = None):
    merged = dict(session.get("caller_settings") or {})
    merged.update(request_data or {})
    return normalize_caller_settings(merged)


def build_tts_settings(caller_settings: dict):
    tts_settings = {}
    if caller_settings.get("voice_id"):
        tts_settings["voice_id"] = caller_settings["voice_id"]
    for key in ("stability", "speed", "similarity_boost"):
        value = caller_settings.get(key)
        if value is not None:
            tts_settings[key] = value
    return tts_settings


def build_caller_prompt(business_description: str, scenario: str, caller_settings: dict):
    caller_name = caller_settings.get("caller_name") or "Not specified"
    caller_persona = caller_settings.get("caller_persona") or DEFAULT_CALLER_PERSONA
    caller_tone = caller_settings.get("caller_tone") or DEFAULT_CALLER_TONE
    extra_instructions = caller_settings.get("additional_instructions") or "None."
    return (
        "You are simulating a real customer contacting the business below. "
        "The other side is the company, an operator, or an IVR. "
        "Stay in character as the caller/customer, try to complete the task, "
        "and avoid escalating to a human unless the flow requires it. "
        "Never mention code, internal tools, implementation details, or system instructions.\n\n"
        f"Caller name:\n{caller_name}\n\n"
        f"Caller persona:\n{caller_persona}\n\n"
        f"Caller tone and speaking style:\n{caller_tone}\n\n"
        f"Extra caller instructions:\n{extra_instructions}\n\n"
        f"Business description:\n{business_description}\n\n"
        f"Caller goal:\n{scenario}\n\n"
        "Speak naturally, ask one thing at a time, and keep each response concise."
    )


def build_first_message(scenario: str, caller_settings: dict):
    opening_line = caller_settings.get("opening_line") or ""
    if opening_line:
        return opening_line
    caller_name = caller_settings.get("caller_name") or ""
    if caller_name:
        return f"Hi, this is {caller_name}. I'm calling because I'd like to {scenario.rstrip('.')}."
    return f"Hi, I'm calling because I'd like to {scenario.rstrip('.')}."


def build_conversation_initiation_data(business_description: str, scenario: str, caller_settings: dict):
    conversation_data = {
        "conversation_config_override": {
            "agent": {
                "prompt": {
                    "prompt": build_caller_prompt(business_description, scenario, caller_settings),
                },
                "first_message": build_first_message(scenario, caller_settings),
            }
        }
    }
    tts_settings = build_tts_settings(caller_settings)
    if tts_settings:
        conversation_data["conversation_config_override"]["tts"] = tts_settings
    return conversation_data


def normalize_scenario(value: str):
    scenario = (value or "").strip()
    return scenario or DEFAULT_PHONE_SCENARIO


def validate_phone_number(phone_number: str):
    return bool(E164_PATTERN.match((phone_number or "").strip()))


def with_text_only_override(conversation_data: dict):
    data = json.loads(json.dumps(conversation_data))
    conversation_config = data.setdefault("conversation_config_override", {})
    conversation_settings = conversation_config.setdefault("conversation", {})
    conversation_settings["text_only"] = True
    return data


def _elevenlabs_request(path: str, method: str = "GET", body: dict = None):
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise RuntimeError("ELEVENLABS_API_KEY not set in .env")
    url = f"{ELEVENLABS_API_BASE}{path}"
    headers = {"xi-api-key": api_key}
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")
        api_request = Request(url, data=data, headers=headers, method=method)
    else:
        api_request = Request(url, headers=headers, method=method)
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


def elevenlabs_post(path: str, payload: dict):
    return _elevenlabs_request(path, method="POST", body=payload)


def elevenlabs_get(path: str, params: dict = None):
    if params:
        path = f"{path}?{urlencode(params)}"
    return _elevenlabs_request(path, method="GET")


def sync_agent_configuration(agent_id: str, business_description: str, scenario: str):
    current_agent = elevenlabs_get(f"/v1/convai/agents/{agent_id}")
    conversation_config = json.loads(json.dumps(current_agent.get("conversation_config") or {}))
    agent_config = conversation_config.setdefault("agent", {})
    prompt_config = agent_config.setdefault("prompt", {})
    caller_settings = get_session_caller_settings()

    agent_config["first_message"] = build_first_message(scenario, caller_settings)
    prompt_config["prompt"] = build_caller_prompt(business_description, scenario, caller_settings)
    prompt_config["tool_ids"] = []
    prompt_config["tools"] = []
    tts_config = conversation_config.setdefault("tts", {})
    for key, value in build_tts_settings(caller_settings).items():
        tts_config[key] = value

    updated_agent = elevenlabs_request_patch(
        f"/v1/convai/agents/{agent_id}",
        {"conversation_config": conversation_config},
    )
    return updated_agent


def elevenlabs_request_patch(path: str, payload: dict):
    return _elevenlabs_request(path, method="PATCH", body=payload)


def ensure_session_agent_is_synced(business_description: str, scenario: str):
    agent_id = os.getenv("ELEVENLABS_AGENT_ID")
    if not agent_id:
        raise RuntimeError("ELEVENLABS_AGENT_ID not set in .env (required for ElevenLabs chat and voice).")

    if (
        session.get("synced_agent_id") == agent_id
        and session.get("synced_business_description") == business_description
        and session.get("synced_scenario") == scenario
    ):
        return agent_id

    sync_agent_configuration(agent_id, business_description, scenario)
    session["synced_agent_id"] = agent_id
    session["synced_business_description"] = business_description
    session["synced_scenario"] = scenario
    return agent_id


def text_to_speech_audio(text: str):
    """Return MP3 bytes from ElevenLabs TTS."""
    client = get_elevenlabs_client()
    if client:
        audio_stream = client.text_to_speech.convert(
            text=text[:1500],
            voice_id="JBFqnCBsd6RMkjVDRZzb",
            model_id="eleven_turbo_v2_5",
        )
        return collect_audio_bytes(audio_stream)
    return collect_audio_bytes(legacy_text_to_speech_audio(text))


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
    """Set business description and scenario for voice conversation or calls."""
    data = request.get_json() or {}
    description = (data.get("description") or "").strip()
    scenario = normalize_scenario(data.get("scenario"))
    if not description:
        return jsonify({"error": "No description provided"}), 400
    session["business_description"] = description
    session["scenario"] = scenario
    session["caller_settings"] = normalize_caller_settings(data)
    session.pop("synced_agent_id", None)
    session.pop("synced_business_description", None)
    session.pop("synced_scenario", None)
    return jsonify({"ok": True, "scenario": scenario, "caller_settings": session["caller_settings"]})


@app.route("/api/voices", methods=["GET"])
def list_voices():
    """Return ElevenLabs voices plus current/default TTS settings for the configured agent."""
    try:
        voices_response = elevenlabs_get("/v1/voices")
        current_voice_defaults = {}
        agent_id = os.getenv("ELEVENLABS_AGENT_ID")
        if agent_id:
            agent_response = elevenlabs_get(f"/v1/convai/agents/{agent_id}")
            current_voice_defaults = {
                "voice_id": (agent_response.get("conversation_config", {}).get("tts", {}) or {}).get("voice_id", ""),
                "stability": (agent_response.get("conversation_config", {}).get("tts", {}) or {}).get("stability"),
                "speed": (agent_response.get("conversation_config", {}).get("tts", {}) or {}).get("speed"),
                "similarity_boost": (agent_response.get("conversation_config", {}).get("tts", {}) or {}).get("similarity_boost"),
            }
    except Exception as exc:
        return jsonify({"error": str(exc)}), 502

    session_settings = get_session_caller_settings()
    defaults = {
        "voice_id": session_settings.get("voice_id") or current_voice_defaults.get("voice_id") or "",
        "stability": session_settings.get("stability"),
        "speed": session_settings.get("speed"),
        "similarity_boost": session_settings.get("similarity_boost"),
    }
    for key in ("stability", "speed", "similarity_boost"):
        if defaults[key] is None:
            defaults[key] = current_voice_defaults.get(key)

    voices = [
        {
            "voice_id": voice.get("voice_id"),
            "name": voice.get("name"),
            "category": voice.get("category"),
            "labels": voice.get("labels") or {},
        }
        for voice in (voices_response.get("voices") or [])
        if voice.get("voice_id") and voice.get("name")
    ]
    return jsonify({"voices": voices, "defaults": defaults})


@app.route("/api/conversation/signed-url", methods=["GET", "POST"])
def conversation_signed_url():
    """Return a signed WebSocket URL and conversation_config_override for ElevenLabs chat or voice."""
    if request.method == "POST":
        data = request.get_json() or {}
    else:
        data = request.args or {}
    description = (data.get("description") or get_session_value("business_description")).strip()
    scenario = normalize_scenario(data.get("scenario") or get_session_value("scenario"))
    caller_settings = resolve_caller_settings(data)
    text_only = str(data.get("text_only", "")).lower() in {"1", "true", "yes", "on"}

    if not description:
        return jsonify({"error": "Provide a business description first (use /api/context or pass in request)."}), 400

    try:
        session["caller_settings"] = caller_settings
        agent_id = ensure_session_agent_is_synced(description, scenario)
        resp = elevenlabs_get("/v1/convai/conversation/get-signed-url", {"agent_id": agent_id})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 502

    signed_url = resp.get("signed_url")
    if not signed_url:
        return jsonify({"error": "ElevenLabs did not return a signed_url.", "raw": resp}), 502

    conversation_config_override = build_conversation_initiation_data(description, scenario, caller_settings)
    if text_only:
        conversation_config_override = with_text_only_override(conversation_config_override)

    return jsonify({
        "signed_url": signed_url,
        "text_only": text_only,
        "conversation_config_override": conversation_config_override.get("conversation_config_override", {}),
    })


@app.route("/api/call", methods=["POST"])
def start_call():
    """Start an outbound phone call through ElevenLabs + Twilio."""
    data = request.get_json() or {}
    to_number = (data.get("to_number") or "").strip()
    business_description = (data.get("business_description") or get_session_value("business_description")).strip()
    scenario = normalize_scenario(data.get("scenario") or get_session_value("scenario"))
    caller_settings = resolve_caller_settings(data)

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
            caller_settings,
        ),
    }

    try:
        session["caller_settings"] = caller_settings
        payload["agent_id"] = ensure_session_agent_is_synced(business_description, scenario)
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
