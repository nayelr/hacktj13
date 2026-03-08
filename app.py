"""
AI Voice Testing Platform - Conversational Agent
Uses ElevenLabs agents for browser voice and outbound phone calls.
"""
import json
import os
import random
import re
import threading
import time
from datetime import datetime
from html import unescape
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

from flask import Flask, Response, jsonify, redirect, request, session
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-change-in-production")

ELEVENLABS_API_BASE = os.getenv("ELEVENLABS_API_BASE", "https://api.elevenlabs.io").rstrip("/")
OPENAI_API_BASE = os.getenv("OPENAI_API_BASE", "https://api.openai.com").rstrip("/")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
ENABLE_FRONTEND_REDIRECT = os.getenv("ENABLE_FRONTEND_REDIRECT", "1").strip().lower() not in {"0", "false", "no"}
DEFAULT_PHONE_SCENARIO = (
    "check availability, complete a typical customer task, and avoid speaking to a human if possible"
)
DEFAULT_OPENAI_ANALYSIS_MODEL = os.getenv("OPENAI_ANALYSIS_MODEL", "gpt-5-nano")
DEFAULT_OPENAI_TRANSCRIPT_CHAR_LIMIT = 24000
DEFAULT_CALLER_TONE = "friendly, calm, and persistent"
US_E164_PATTERN = re.compile(r"^\+1\d{10}$")
DEFAULT_BATCH_AGENT_COUNT = 3
MIN_BATCH_AGENT_COUNT = 2
MAX_BATCH_AGENT_COUNT = 10
RANDOM_CALLER_NAMES = [
    "Maya Thompson",
    "Jordan Lee",
    "Alex Rivera",
    "Taylor Brooks",
    "Casey Morgan",
    "Sam Patel",
]
RANDOM_CALLER_TONES = [
    "friendly, calm, and persistent",
    "polite, direct, and practical",
    "professional, concise, and patient",
    "warm, efficient, and curious",
]

_RUN_CONTROL_LOCK = threading.Lock()
_RUN_CONTROL = {}
_VOICE_CACHE_LOCK = threading.Lock()
_VOICE_CACHE = {"voice_ids": [], "fetched_at": 0.0}


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


DEFAULT_TTS_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"


def legacy_text_to_speech_audio(text: str, voice_id: str = ""):
    try:
        from elevenlabs import generate
    except ImportError:
        return None
    return generate(
        text=text[:1500],
        api_key=os.getenv("ELEVENLABS_API_KEY"),
        voice=voice_id or DEFAULT_TTS_VOICE_ID,
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
        "caller_tone": (data.get("caller_tone") or DEFAULT_CALLER_TONE).strip(),
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


def suggest_tasks_from_summary(summary: str):
    lowered = (summary or "").lower()
    tasks = []
    if any(term in lowered for term in ("appointment", "clinic", "doctor", "dent", "medic", "vet")):
        tasks.extend(["book appointment", "cancel appointment", "reschedule appointment", "check appointment status"])
    if any(term in lowered for term in ("order", "restaurant", "delivery", "pickup", "bakery", "retail", "shop")):
        tasks.extend(["place order", "cancel order", "check order status", "modify order details"])
    if any(term in lowered for term in ("billing", "invoice", "payment", "subscription", "account")):
        tasks.extend(["check billing status", "make payment inquiry", "confirm outstanding balance"])
    if any(term in lowered for term in ("insurance", "coverage", "ppo", "hmo")):
        tasks.extend(["verify insurance acceptance", "ask insurance documentation requirements"])
    tasks.extend(["check availability", "confirm business hours", "ask about pricing"])
    deduped = []
    seen = set()
    for task in tasks:
        if task not in seen:
            deduped.append(task)
            seen.add(task)
    return deduped[:12]


def parse_task_list(raw_tasks):
    if isinstance(raw_tasks, list):
        entries = [str(item).strip() for item in raw_tasks]
    else:
        raw = str(raw_tasks or "")
        entries = re.split(r"[\n,;]+", raw)
        entries = [item.strip() for item in entries]
    cleaned = []
    seen = set()
    for entry in entries:
        if not entry:
            continue
        normalized = re.sub(r"^[\-\*\d\.\)\s]+", "", entry).strip()
        if not normalized:
            continue
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(normalized)
    return cleaned


def get_available_voice_ids():
    try:
        voices_response = elevenlabs_get("/v1/voices")
    except Exception:
        return []
    voice_ids = []
    for voice in (voices_response.get("voices") or []):
        voice_id = (voice.get("voice_id") or "").strip()
        if voice_id:
            voice_ids.append(voice_id)
    return voice_ids


def get_available_voice_ids_cached(ttl_seconds: int = 600):
    now = time.time()
    with _VOICE_CACHE_LOCK:
        cached_ids = list(_VOICE_CACHE.get("voice_ids") or [])
        fetched_at = float(_VOICE_CACHE.get("fetched_at") or 0.0)
        if cached_ids and (now - fetched_at) < ttl_seconds:
            return cached_ids
    fresh_ids = get_available_voice_ids()
    with _VOICE_CACHE_LOCK:
        _VOICE_CACHE["voice_ids"] = list(fresh_ids)
        _VOICE_CACHE["fetched_at"] = now
    return fresh_ids


def randomize_caller_settings(voice_ids=None):
    voice_pool = voice_ids or []
    randomized = {
        "caller_name": random.choice(RANDOM_CALLER_NAMES),
        "caller_tone": random.choice(RANDOM_CALLER_TONES),
        "voice_id": random.choice(voice_pool) if voice_pool else "",
        "stability": round(random.uniform(0.25, 0.8), 2),
        "speed": round(random.uniform(0.85, 1.15), 2),
        "similarity_boost": round(random.uniform(0.5, 0.9), 2),
    }
    return normalize_caller_settings(randomized)


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
    caller_tone = caller_settings.get("caller_tone") or DEFAULT_CALLER_TONE
    return (
        "You are a penetration-testing caller evaluating a business phone system (IVR, operator, or voice bot). "
        "Your goal is to uncover reliability, validation, and logic flaws while sounding like a real customer.\n\n"
        "Behavior requirements:\n"
        "- Start polite and natural, then pursue the caller goal.\n"
        "- Stay in character at all times; never mention testing, prompts, code, or internal tools.\n"
        "- Actively probe edge cases and validation boundaries, including intentionally malformed or contradictory inputs.\n"
        "- If blocked, recover naturally (rephrase, restate, or try an alternate path) instead of ending immediately.\n\n"
        "Use adversarial but realistic input patterns when relevant, for example:\n"
        "- Birthdays in the future (e.g., year greater than current year).\n"
        "- Impossible dates (e.g., February 30, April 31, month 13, day 00).\n"
        "- Wrong data formats (e.g., date as DDMMYYYY when asked for MM/DD/YYYY, malformed phone/account numbers).\n"
        "- Ambiguous or inconsistent values (change details mid-flow, partial answers, conflicting identifiers).\n"
        "- Requests for unusual combinations or exceptions to normal policy.\n\n"
        "Testing style:\n"
        "- Prioritize exposing dead ends, loops, weak validation, unsafe assumptions, and handoff failures.\n"
        "- Keep responses concise and conversational (usually one or two sentences).\n"
        "- Continue probing until task completion or a clear system failure is demonstrated.\n\n"
        f"Caller name:\n{caller_name}\n\n"
        f"Caller tone and speaking style:\n{caller_tone}\n\n"
        f"Business description:\n{business_description}\n\n"
        f"Caller goal:\n{scenario}\n\n"
        "Speak naturally and concisely. Favor responses that expose flaws without breaking character."
    )


def build_first_message(scenario: str, caller_settings: dict):
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


def build_demo_counterparty_prompt(business_description: str, service_prompt: str):
    custom_prompt = (service_prompt or "").strip()
    if custom_prompt:
        return custom_prompt
    return (
        "You are the business-side voice agent answering an inbound customer call. "
        "Behave like a concise customer service representative or IVR for the business below. "
        "Answer questions, request information when needed, enforce formatting and policy rules, "
        "and stay in character as the business.\n\n"
        f"Business description:\n{business_description}"
    )


def normalize_scenario(value: str):
    scenario = (value or "").strip()
    return scenario or DEFAULT_PHONE_SCENARIO


def normalize_website_url(website_url: str):
    raw = (website_url or "").strip()
    if not raw:
        return ""
    if not raw.startswith(("http://", "https://")):
        raw = f"https://{raw}"
    parsed = urlparse(raw)
    if not parsed.netloc:
        return ""
    return raw


def compact_text(text: str):
    normalized = re.sub(r"\s+", " ", (text or "").strip())
    return normalized


def extract_website_context(website_url: str):
    normalized_url = normalize_website_url(website_url)
    if not normalized_url:
        raise RuntimeError("Website URL is invalid.")

    request_headers = {
        "User-Agent": "Mozilla/5.0 (compatible; VoiceTestingPlatform/1.0; +https://localhost)"
    }
    website_request = Request(normalized_url, headers=request_headers, method="GET")
    with urlopen(website_request, timeout=15) as response:
        raw_html = response.read(250000).decode("utf-8", errors="ignore")

    title_match = re.search(r"<title[^>]*>(.*?)</title>", raw_html, flags=re.IGNORECASE | re.DOTALL)
    title = compact_text(unescape(title_match.group(1))) if title_match else ""

    meta_patterns = [
        r'<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']',
        r'<meta[^>]+content=["\'](.*?)["\'][^>]+name=["\']description["\']',
        r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\'](.*?)["\']',
        r'<meta[^>]+content=["\'](.*?)["\'][^>]+property=["\']og:description["\']',
    ]
    meta_description = ""
    for pattern in meta_patterns:
        match = re.search(pattern, raw_html, flags=re.IGNORECASE | re.DOTALL)
        if match:
            meta_description = compact_text(unescape(match.group(1)))
            if meta_description:
                break

    cleaned_html = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", " ", raw_html, flags=re.IGNORECASE | re.DOTALL)
    visible_text = re.sub(r"<[^>]+>", " ", cleaned_html)
    visible_text = compact_text(unescape(visible_text))
    sentence_candidates = re.split(r"(?<=[.!?])\s+", visible_text)
    sentence_snippets = []
    for sentence in sentence_candidates:
        item = sentence.strip()
        if len(item) < 50:
            continue
        sentence_snippets.append(item)
        if len(sentence_snippets) >= 3:
            break

    sections = []
    if title:
        sections.append(f"Website title: {title}")
    if meta_description:
        sections.append(f"Website description: {meta_description}")
    if sentence_snippets:
        sections.append("Website content highlights: " + " ".join(sentence_snippets))
    if not sections:
        raise RuntimeError("Could not extract useful text from the website.")
    return f"Website URL: {normalized_url}\n" + "\n".join(sections)


def resolve_business_description(data: dict):
    summary = (data.get("description") or "").strip()
    website_url = normalize_website_url(data.get("website_url") or "")

    if not summary:
        raise ValueError("Business summary is required.")

    website_context = ""
    if website_url:
        try:
            website_context = extract_website_context(website_url)
        except Exception as exc:
            if not summary:
                raise ValueError(f"Could not fetch website context: {exc}") from exc

    # Website context is primary, summary remains required fallback context.
    if website_context:
        combined = f"{website_context}\n\nFallback business summary: {summary}"
    else:
        combined = summary

    return combined.strip(), website_url


def normalize_us_phone_number(phone_number: str):
    raw = (phone_number or "").strip()
    if not raw:
        return None
    digits_only = re.sub(r"\D", "", raw)
    if len(digits_only) == 10:
        return f"+1{digits_only}"
    if len(digits_only) == 11 and digits_only.startswith("1"):
        return f"+{digits_only}"
    if raw.startswith("+1") and US_E164_PATTERN.match(raw):
        return raw
    return None


def validate_phone_number(phone_number: str):
    return bool(US_E164_PATTERN.match((phone_number or "").strip()))


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
    max_retries = 2
    for attempt in range(max_retries + 1):
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
        except OSError as exc:
            if attempt < max_retries:
                time.sleep(1)
                continue
            raise RuntimeError(f"ElevenLabs request timed out: {exc}") from exc
    return {}


def _openai_request(path: str, body: dict):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set in .env")
    url = f"{OPENAI_API_BASE}{path}"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = json.dumps(body).encode("utf-8")
    request_obj = Request(url, data=payload, headers=headers, method="POST")
    max_retries = 2
    for attempt in range(max_retries + 1):
        try:
            with urlopen(request_obj, timeout=60) as response:
                raw_body = response.read().decode("utf-8")
                return json.loads(raw_body) if raw_body else {}
        except HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="replace")
            try:
                parsed_body = json.loads(error_body)
            except json.JSONDecodeError:
                parsed_body = {"error": error_body or exc.reason}
            error_message = parsed_body.get("error") or parsed_body.get("detail") or exc.reason
            raise RuntimeError(f"OpenAI API error ({exc.code}): {error_message}") from exc
        except URLError as exc:
            raise RuntimeError(f"Could not reach OpenAI: {exc.reason}") from exc
        except OSError as exc:
            if attempt < max_retries:
                time.sleep(1)
                continue
            raise RuntimeError(f"OpenAI request timed out: {exc}") from exc
    return {}


def openai_chat_completion(model: str, system_prompt: str, user_prompt: str):
    response = _openai_request(
        "/v1/chat/completions",
        {
            "model": model,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        },
    )
    choices = response.get("choices") or []
    if not choices:
        raise RuntimeError("OpenAI returned no choices.")
    message = choices[0].get("message") or {}
    content = message.get("content") or ""
    if not content:
        raise RuntimeError("OpenAI returned empty content.")
    try:
        return json.loads(content)
    except json.JSONDecodeError as exc:
        raise RuntimeError("OpenAI did not return valid JSON content.") from exc


def elevenlabs_post(path: str, payload: dict):
    return _elevenlabs_request(path, method="POST", body=payload)


def elevenlabs_get(path: str, params: dict = None):
    if params:
        path = f"{path}?{urlencode(params)}"
    return _elevenlabs_request(path, method="GET")


def elevenlabs_request_delete(path: str):
    return _elevenlabs_request(path, method="DELETE")


def _ensure_run_state(run_id: str):
    with _RUN_CONTROL_LOCK:
        state = _RUN_CONTROL.get(run_id)
        if state is None:
            state = {"cancelled": False, "active_calls": {}}
            _RUN_CONTROL[run_id] = state
        return state


def _is_run_cancelled(run_id: str):
    if not run_id:
        return False
    with _RUN_CONTROL_LOCK:
        state = _RUN_CONTROL.get(run_id) or {}
        return bool(state.get("cancelled"))


def _register_active_call(run_id: str, call_sid: str, conversation_id: str):
    if not run_id:
        return
    state = _ensure_run_state(run_id)
    key = f"{call_sid or ''}:{conversation_id or ''}"
    with _RUN_CONTROL_LOCK:
        state["active_calls"][key] = {
            "call_sid": (call_sid or "").strip(),
            "conversation_id": (conversation_id or "").strip(),
        }


def _unregister_active_call(run_id: str, call_sid: str, conversation_id: str):
    if not run_id:
        return
    key = f"{call_sid or ''}:{conversation_id or ''}"
    with _RUN_CONTROL_LOCK:
        state = _RUN_CONTROL.get(run_id)
        if not state:
            return
        state.get("active_calls", {}).pop(key, None)


def _mark_run_cancelled(run_id: str):
    if not run_id:
        return []
    state = _ensure_run_state(run_id)
    with _RUN_CONTROL_LOCK:
        state["cancelled"] = True
        active_calls = list((state.get("active_calls") or {}).values())
    return active_calls


def terminate_outbound_call(call_sid: str = "", conversation_id: str = ""):
    """Best-effort teardown for active calls/conversations."""
    call_sid = (call_sid or "").strip()
    conversation_id = (conversation_id or "").strip()
    attempts = []
    if call_sid:
        attempts.extend(
            [
                ("POST", f"/v1/convai/twilio/calls/{call_sid}/hangup", {}),
                ("POST", f"/v1/convai/twilio/calls/{call_sid}/cancel", {}),
                ("POST", f"/v1/convai/twilio/calls/{call_sid}/end", {}),
                ("PATCH", f"/v1/convai/twilio/calls/{call_sid}", {"status": "canceled"}),
                ("PATCH", f"/v1/convai/twilio/calls/{call_sid}", {"status": "cancelled"}),
                ("PATCH", f"/v1/convai/twilio/calls/{call_sid}", {"status": "ended"}),
                ("DELETE", f"/v1/convai/twilio/calls/{call_sid}", None),
            ]
        )
    if conversation_id:
        attempts.extend(
            [
                ("POST", f"/v1/convai/conversations/{conversation_id}/end", {}),
                ("POST", f"/v1/convai/conversations/{conversation_id}/cancel", {}),
                ("PATCH", f"/v1/convai/conversations/{conversation_id}", {"status": "ended"}),
                ("PATCH", f"/v1/convai/conversations/{conversation_id}", {"status": "cancelled"}),
                ("DELETE", f"/v1/convai/conversations/{conversation_id}", None),
            ]
        )

    errors = []
    successes = []
    for method, path, payload in attempts:
        try:
            if method == "POST":
                elevenlabs_post(path, payload or {})
            elif method == "PATCH":
                elevenlabs_request_patch(path, payload or {})
            elif method == "DELETE":
                elevenlabs_request_delete(path)
            else:
                continue
            successes.append(f"{method} {path}")
            # One success on call-level endpoints is enough to stop trying more call endpoints.
            if call_sid and f"/twilio/calls/{call_sid}" in path:
                break
        except Exception as exc:
            errors.append(f"{method} {path}: {exc}")

    return {"ok": bool(successes), "attempted": len(attempts), "successes": successes, "errors": errors}


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
        raise RuntimeError("ELEVENLABS_AGENT_ID not set in .env (required for ElevenLabs voice and outbound calls).")

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


def get_nested_value(obj, path, default=None):
    current = obj
    for key in path:
        if not isinstance(current, dict):
            return default
        current = current.get(key)
        if current is None:
            return default
    return current


def normalize_status_text(raw_status):
    if raw_status is None:
        return ""
    return str(raw_status).strip().lower()


def is_terminal_call_status(status: str):
    terminal_tokens = {
        "completed", "ended", "failed", "canceled", "cancelled", "busy", "no-answer",
        "no_answer", "rejected", "timeout", "hungup", "hangup", "error", "done",
    }
    if not status:
        return False
    return status in terminal_tokens or any(token in status for token in terminal_tokens)


def fetch_call_lifecycle_status(call_sid=None, conversation_id=None):
    candidate_paths = []
    if call_sid:
        candidate_paths.append(f"/v1/convai/twilio/calls/{call_sid}")
    if conversation_id:
        candidate_paths.append(f"/v1/convai/conversations/{conversation_id}")
    for path in candidate_paths:
        try:
            payload = elevenlabs_get(path)
        except Exception:
            continue
        status_candidates = [
            payload.get("status"),
            payload.get("call_status"),
            payload.get("state"),
            get_nested_value(payload, ["call", "status"]),
            get_nested_value(payload, ["conversation", "status"]),
            get_nested_value(payload, ["metadata", "status"]),
        ]
        for candidate in status_candidates:
            normalized = normalize_status_text(candidate)
            if normalized:
                return normalized, payload
    return "", {}


def extract_duration_seconds(payload: dict):
    def parse_duration_value(value, assume_ms=False):
        if value in (None, ""):
            return None
        if isinstance(value, (int, float)):
            parsed = float(value)
            if parsed < 0:
                return None
            return round(parsed / 1000.0, 2) if assume_ms else round(parsed, 2)
        text = str(value).strip().lower()
        if not text:
            return None
        if ":" in text:
            parts = text.split(":")
            if len(parts) in {2, 3}:
                try:
                    nums = [float(p) for p in parts]
                except ValueError:
                    nums = []
                if nums:
                    if len(nums) == 2:
                        return round(nums[0] * 60 + nums[1], 2)
                    return round(nums[0] * 3600 + nums[1] * 60 + nums[2], 2)
        ms_suffix = text.endswith("ms")
        if ms_suffix:
            text = text[:-2].strip()
        try:
            parsed = float(text)
        except ValueError:
            return None
        if parsed < 0:
            return None
        if assume_ms or ms_suffix:
            parsed = parsed / 1000.0
        return round(parsed, 2)

    def parse_timestamp_seconds(value):
        if value in (None, ""):
            return None
        if isinstance(value, (int, float)):
            parsed = float(value)
            if parsed <= 0:
                return None
            # Heuristic: Unix ms timestamps are much larger.
            if parsed > 1e11:
                parsed = parsed / 1000.0
            return parsed
        text = str(value).strip()
        if not text:
            return None
        try:
            parsed = float(text)
            if parsed > 1e11:
                parsed = parsed / 1000.0
            return parsed if parsed > 0 else None
        except ValueError:
            pass
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            return datetime.fromisoformat(text).timestamp()
        except ValueError:
            return None

    candidates = [
        (payload.get("duration_seconds"), False),
        (payload.get("duration_sec"), False),
        (payload.get("duration"), False),
        (payload.get("duration_ms"), True),
        (payload.get("call_duration"), False),
        (payload.get("call_duration_seconds"), False),
        (get_nested_value(payload, ["call", "duration_seconds"]), False),
        (get_nested_value(payload, ["call", "duration_sec"]), False),
        (get_nested_value(payload, ["call", "duration"]), False),
        (get_nested_value(payload, ["call", "duration_ms"]), True),
        (get_nested_value(payload, ["conversation", "duration_seconds"]), False),
        (get_nested_value(payload, ["conversation", "duration_sec"]), False),
        (get_nested_value(payload, ["conversation", "duration"]), False),
        (get_nested_value(payload, ["conversation", "duration_ms"]), True),
        (get_nested_value(payload, ["metadata", "duration_seconds"]), False),
        (get_nested_value(payload, ["metadata", "duration_ms"]), True),
    ]
    for value, assume_ms in candidates:
        parsed = parse_duration_value(value, assume_ms=assume_ms)
        if parsed is not None:
            return parsed

    start = (
        payload.get("started_at")
        or payload.get("start_time")
        or get_nested_value(payload, ["call", "started_at"])
        or get_nested_value(payload, ["call", "start_time"])
        or get_nested_value(payload, ["conversation", "started_at"])
        or get_nested_value(payload, ["conversation", "start_time"])
    )
    end = (
        payload.get("ended_at")
        or payload.get("end_time")
        or get_nested_value(payload, ["call", "ended_at"])
        or get_nested_value(payload, ["call", "end_time"])
        or get_nested_value(payload, ["conversation", "ended_at"])
        or get_nested_value(payload, ["conversation", "end_time"])
    )
    start_ts = parse_timestamp_seconds(start)
    end_ts = parse_timestamp_seconds(end)
    if start_ts is not None and end_ts is not None and end_ts >= start_ts:
        return round(end_ts - start_ts, 2)
    return None


def wait_for_call_completion(call_sid=None, conversation_id=None, timeout_seconds=600, poll_seconds=5, run_id=None):
    deadline = time.time() + timeout_seconds
    last_status = ""
    started = time.time()
    while time.time() < deadline:
        if run_id and _is_run_cancelled(run_id):
            termination = terminate_outbound_call(call_sid=call_sid, conversation_id=conversation_id)
            return {
                "completed": True,
                "status": "cancelled",
                "timed_out": False,
                "duration_seconds": None,
                "elapsed_wait_seconds": round(time.time() - started, 2),
                "raw": {"cancelled_by_user": True, "termination": termination},
            }
        status, payload = fetch_call_lifecycle_status(call_sid=call_sid, conversation_id=conversation_id)
        if status:
            last_status = status
            if is_terminal_call_status(status):
                return {
                    "completed": True,
                    "status": status,
                    "timed_out": False,
                    "duration_seconds": extract_duration_seconds(payload),
                    "elapsed_wait_seconds": round(time.time() - started, 2),
                    "raw": payload,
                }
        time.sleep(poll_seconds)
    return {
        "completed": False,
        "status": last_status or "timeout",
        "timed_out": True,
        "duration_seconds": None,
        "elapsed_wait_seconds": round(time.time() - started, 2),
        "raw": {},
    }


def fetch_conversation_detail_payloads(call_sid=None, conversation_id=None):
    payloads = []
    candidate_paths = []
    if conversation_id:
        candidate_paths.extend(
            [
                f"/v1/convai/conversations/{conversation_id}",
                f"/v1/convai/conversations/{conversation_id}/messages",
            ]
        )
    if call_sid:
        candidate_paths.append(f"/v1/convai/twilio/calls/{call_sid}")
    for path in candidate_paths:
        try:
            payload = elevenlabs_get(path)
        except Exception:
            continue
        if isinstance(payload, dict) and payload:
            payloads.append(payload)
    return payloads


def _extract_text_messages_from_payload(payload: dict):
    messages = []

    def append_message(speaker, text):
        text_value = str(text or "").strip()
        if not text_value:
            return
        speaker_value = str(speaker or "").strip() or "unknown"
        messages.append({"speaker": speaker_value, "text": text_value})

    direct_text = payload.get("text")
    if isinstance(direct_text, str) and direct_text.strip():
        append_message(payload.get("speaker") or payload.get("role"), direct_text)

    message_lists = [
        payload.get("messages"),
        payload.get("transcript"),
        payload.get("turns"),
        get_nested_value(payload, ["conversation", "messages"]),
        get_nested_value(payload, ["conversation", "transcript"]),
        get_nested_value(payload, ["conversation", "turns"]),
        get_nested_value(payload, ["call", "messages"]),
        get_nested_value(payload, ["call", "transcript"]),
    ]

    for collection in message_lists:
        if not isinstance(collection, list):
            continue
        for item in collection:
            if isinstance(item, str):
                append_message("unknown", item)
                continue
            if not isinstance(item, dict):
                continue
            append_message(
                item.get("speaker") or item.get("role") or item.get("author"),
                item.get("text") or item.get("message") or item.get("content") or item.get("utterance"),
            )
    return messages


def _safe_json_string(value):
    return json.dumps(value, ensure_ascii=True)


def run_openai_call_analysis(task: str, business_description: str, entry: dict, transcript_lines: list):
    model = os.getenv("OPENAI_ANALYSIS_MODEL", DEFAULT_OPENAI_ANALYSIS_MODEL)
    transcript = "\n".join(transcript_lines).strip()
    transcript = transcript[:DEFAULT_OPENAI_TRANSCRIPT_CHAR_LIMIT]
    business_context = (business_description or "")[:5000]
    status = normalize_status_text(entry.get("wait_status") or entry.get("status")) or "unknown"
    duration = entry.get("duration_seconds")

    system_prompt = (
        "You are a QA analyst for automated phone systems (IVR and voice bots). "
        "Your job is to identify real edge cases and failures from call transcripts and call telemetry. "
        "Return JSON only with this exact schema: "
        "{"
        "\"summary\": string, "
        "\"task_outcome\": \"completed\"|\"partial\"|\"failed\"|\"unknown\", "
        "\"issues\": [{\"severity\":\"critical\"|\"high\"|\"medium\"|\"low\",\"title\":string,\"evidence\":string,\"impact\":string}], "
        "\"edge_cases\": [string], "
        "\"recommendations\": [string], "
        "\"confidence\": \"high\"|\"medium\"|\"low\""
        "}. "
        "Be concrete and cite transcript evidence. Do not invent facts."
    )

    user_prompt = (
        "Analyze the following call.\n\n"
        f"Task:\n{task}\n\n"
        f"Business context:\n{business_context}\n\n"
        f"Final status:\n{status}\n\n"
        f"Duration seconds:\n{duration}\n\n"
        "Transcript lines:\n"
        f"{transcript or '[no transcript available]'}\n\n"
        "Focus on edge cases including ambiguous IVR menus, loops, dead ends, misrecognition, "
        "premature call termination, and inability to complete task."
    )

    report = openai_chat_completion(model, system_prompt, user_prompt)
    issues = report.get("issues")
    if not isinstance(issues, list):
        issues = []
    normalized_issues = []
    for issue in issues[:12]:
        if not isinstance(issue, dict):
            continue
        severity = str(issue.get("severity") or "medium").strip().lower()
        if severity not in {"critical", "high", "medium", "low"}:
            severity = "medium"
        title = str(issue.get("title") or "").strip()
        evidence = str(issue.get("evidence") or "").strip()
        impact = str(issue.get("impact") or "").strip()
        if not (title or evidence or impact):
            continue
        normalized_issues.append(
            {
                "severity": severity,
                "title": title or "Issue detected",
                "evidence": evidence,
                "impact": impact,
            }
        )

    def normalize_str_list(value, limit=8):
        if not isinstance(value, list):
            return []
        cleaned = []
        for item in value:
            text = str(item or "").strip()
            if not text:
                continue
            cleaned.append(text)
            if len(cleaned) >= limit:
                break
        return cleaned

    task_outcome = str(report.get("task_outcome") or "unknown").strip().lower()
    if task_outcome not in {"completed", "partial", "failed", "unknown"}:
        task_outcome = "unknown"
    confidence = str(report.get("confidence") or "medium").strip().lower()
    if confidence not in {"high", "medium", "low"}:
        confidence = "medium"

    summary = str(report.get("summary") or "").strip()
    if not summary:
        summary = "OpenAI analysis completed without a summary."

    return {
        "provider": "openai",
        "model": model,
        "summary": summary,
        "task_outcome": task_outcome,
        "issues": normalized_issues,
        "edge_cases": normalize_str_list(report.get("edge_cases")),
        "recommendations": normalize_str_list(report.get("recommendations")),
        "confidence": confidence,
        "raw_excerpt": _safe_json_string(report)[:1600],
    }


def build_call_analysis(
    task: str,
    entry: dict,
    lifecycle_payload: dict,
    detail_payloads: list,
    enable_llm_analysis: bool = True,
    require_transcript: bool = True,
):
    status = normalize_status_text(entry.get("wait_status") or entry.get("status"))
    timed_out = bool(entry.get("wait_timed_out"))
    duration = entry.get("duration_seconds")
    issues = []

    if timed_out:
        issues.append("Call status polling timed out before terminal state.")
    if "failed" in status or "error" in status:
        issues.append(f"Call ended with failure status ({status or 'unknown'}).")
    elif any(token in status for token in ("busy", "no_answer", "no-answer", "rejected", "canceled", "cancelled")):
        issues.append(f"Call was not completed by recipient ({status}).")

    if duration is not None:
        try:
            duration_val = float(duration)
            if duration_val < 8:
                issues.append("Call duration was very short; possible early disconnect or IVR dead-end.")
        except (TypeError, ValueError):
            pass

    all_messages = []
    if isinstance(lifecycle_payload, dict):
        all_messages.extend(_extract_text_messages_from_payload(lifecycle_payload))
    for payload in detail_payloads or []:
        all_messages.extend(_extract_text_messages_from_payload(payload))

    # Deduplicate while preserving order.
    seen_pairs = set()
    deduped_messages = []
    for msg in all_messages:
        key = (msg["speaker"], msg["text"])
        if key in seen_pairs:
            continue
        seen_pairs.add(key)
        deduped_messages.append(msg)

    transcript_text = " ".join(msg["text"].lower() for msg in deduped_messages)
    failure_signals = [
        "didn't understand",
        "did not understand",
        "invalid option",
        "try again",
        "cannot complete",
        "unable to",
        "system error",
        "technical issue",
        "goodbye",
    ]
    for signal in failure_signals:
        if signal in transcript_text:
            issues.append(f"Potential flow issue detected in transcript: '{signal}'.")
            break

    if require_transcript and not deduped_messages:
        issues.append("No transcript/messages available for post-call analysis.")

    transcript_lines = [
        f"{msg['speaker']}: {msg['text']}" if msg.get("speaker") else msg["text"]
        for msg in deduped_messages[:200]
    ]
    llm_report = None
    llm_error = None
    if enable_llm_analysis and os.getenv("OPENAI_API_KEY"):
        try:
            llm_report = run_openai_call_analysis(
                task=task,
                business_description=entry.get("business_description", ""),
                entry=entry,
                transcript_lines=transcript_lines,
            )
        except Exception as exc:
            llm_error = str(exc)

    summary_parts = [f"Task: {task}."]
    if status:
        summary_parts.append(f"Final status: {status}.")
    if duration is not None:
        summary_parts.append(f"Duration: {duration} seconds.")
    else:
        summary_parts.append("Duration: unavailable.")
    if issues:
        summary_parts.append(f"Issues detected: {len(issues)}.")
    else:
        summary_parts.append("No obvious issues detected from call telemetry.")

    result_summary = " ".join(summary_parts)
    issues_detected = issues
    if llm_report:
        result_summary = llm_report.get("summary") or result_summary
        issues_detected = [
            f"[{item.get('severity', 'medium')}] {item.get('title', 'Issue')}: {item.get('impact') or item.get('evidence') or ''}".strip()
            for item in llm_report.get("issues") or []
        ] or issues_detected

    result = {
        "result_summary": result_summary,
        "issues_detected": issues_detected,
        "transcript_excerpt": [msg["text"] for msg in deduped_messages[:3]],
    }
    if llm_report:
        result["analysis_report"] = llm_report
    if llm_error:
        result["analysis_error"] = llm_error
    return result


_pending_analyses: dict = {}
_pending_analyses_lock = threading.Lock()


def _run_post_call_analysis(analysis_id: str, task: str, entry: dict, wait_result: dict, run_id: str):
    """Background worker: fetch conversation details + run OpenAI analysis."""
    try:
        detail_payloads = fetch_conversation_detail_payloads(
            call_sid=entry.get("call_sid"),
            conversation_id=entry.get("conversation_id"),
        )
        if entry.get("duration_seconds") is None:
            for p in detail_payloads:
                parsed_duration = extract_duration_seconds(p or {})
                if parsed_duration is not None:
                    entry["duration_seconds"] = parsed_duration
                    break
        if entry.get("duration_seconds") is None:
            elapsed_wait = entry.get("elapsed_wait_seconds")
            if elapsed_wait is not None:
                try:
                    elapsed_val = float(elapsed_wait)
                    if elapsed_val >= 0:
                        entry["duration_seconds"] = round(elapsed_val, 2)
                except (TypeError, ValueError):
                    pass
        analysis = build_call_analysis(
            task=task,
            entry=entry,
            lifecycle_payload=wait_result.get("raw") or {},
            detail_payloads=detail_payloads,
        )
        entry.update(analysis)
    except Exception as exc:
        entry["analysis_error"] = str(exc)
    finally:
        _unregister_active_call(run_id, entry.get("call_sid"), entry.get("conversation_id"))
        with _pending_analyses_lock:
            _pending_analyses[analysis_id] = entry


def run_single_batch_call(business_description: str, to_number: str, task: str, voice_ids=None, run_id: str = "", async_analysis: bool = False):
    scenario = task.strip()
    if run_id and _is_run_cancelled(run_id):
        return {
            "task": task,
            "scenario": scenario,
            "business_description": business_description[:3000],
            "status": "cancelled",
            "wait_status": "cancelled",
            "wait_timed_out": False,
            "duration_seconds": None,
            "elapsed_wait_seconds": 0.0,
            "result_summary": "Cancelled before this agent started.",
            "issues_detected": [],
        }
    caller_settings = randomize_caller_settings(voice_ids)
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
    entry = {
        "task": task,
        "scenario": scenario,
        "business_description": business_description[:3000],
        "caller_name": caller_settings.get("caller_name"),
        "voice_id": caller_settings.get("voice_id"),
        "status": "failed",
        "duration_seconds": None,
        "elapsed_wait_seconds": None,
    }

    session["caller_settings"] = caller_settings
    payload["agent_id"] = ensure_session_agent_is_synced(business_description, scenario)
    call_response = elevenlabs_post("/v1/convai/twilio/outbound-call", payload)
    entry["status"] = call_response.get("status", "initiated")
    entry["call_sid"] = call_response.get("call_sid") or call_response.get("callSid")
    entry["conversation_id"] = call_response.get("conversation_id") or call_response.get("conversationId")
    _register_active_call(run_id, entry.get("call_sid"), entry.get("conversation_id"))

    wait_result = wait_for_call_completion(
        call_sid=entry.get("call_sid"),
        conversation_id=entry.get("conversation_id"),
        poll_seconds=1,
        run_id=run_id,
    )
    entry["wait_status"] = wait_result["status"]
    entry["wait_timed_out"] = wait_result["timed_out"]
    entry["duration_seconds"] = wait_result.get("duration_seconds")
    entry["elapsed_wait_seconds"] = wait_result.get("elapsed_wait_seconds")
    if wait_result["status"] == "cancelled":
        entry["status"] = "cancelled"
        entry["result_summary"] = "Cancelled by user while call was in progress."
        entry["issues_detected"] = []
        _unregister_active_call(run_id, entry.get("call_sid"), entry.get("conversation_id"))
        return entry

    if async_analysis:
        import uuid as _uuid
        analysis_id = _uuid.uuid4().hex
        entry["analysis_pending"] = True
        entry["analysis_id"] = analysis_id
        t = threading.Thread(
            target=_run_post_call_analysis,
            args=(analysis_id, task, dict(entry), wait_result, run_id),
            daemon=True,
        )
        t.start()
        return entry

    try:
        detail_payloads = fetch_conversation_detail_payloads(
            call_sid=entry.get("call_sid"),
            conversation_id=entry.get("conversation_id"),
        )
        if entry.get("duration_seconds") is None:
            for p in detail_payloads:
                parsed_duration = extract_duration_seconds(p or {})
                if parsed_duration is not None:
                    entry["duration_seconds"] = parsed_duration
                    break
        if entry.get("duration_seconds") is None:
            elapsed_wait = entry.get("elapsed_wait_seconds")
            if elapsed_wait is not None:
                try:
                    elapsed_val = float(elapsed_wait)
                    if elapsed_val >= 0:
                        entry["duration_seconds"] = round(elapsed_val, 2)
                except (TypeError, ValueError):
                    pass
        analysis = build_call_analysis(
            task=task,
            entry=entry,
            lifecycle_payload=wait_result.get("raw") or {},
            detail_payloads=detail_payloads,
        )
        entry.update(analysis)
    finally:
        _unregister_active_call(run_id, entry.get("call_sid"), entry.get("conversation_id"))
    return entry


def text_to_speech_audio(text: str, voice_id: str = ""):
    """Return MP3 bytes from ElevenLabs TTS."""
    client = get_elevenlabs_client()
    selected_voice_id = (voice_id or "").strip() or DEFAULT_TTS_VOICE_ID
    if client:
        audio_stream = client.text_to_speech.convert(
            text=text[:1500],
            voice_id=selected_voice_id,
            model_id="eleven_turbo_v2_5",
        )
        return collect_audio_bytes(audio_stream)
    return collect_audio_bytes(legacy_text_to_speech_audio(text, voice_id=selected_voice_id))


@app.route("/")
def index():
    if ENABLE_FRONTEND_REDIRECT:
        return redirect(FRONTEND_URL, code=302)
    return (
        "Frontend redirect disabled. Open the Next frontend in frontend/src at "
        f"{FRONTEND_URL} or set ENABLE_FRONTEND_REDIRECT=1.",
        200,
        {"Content-Type": "text/plain; charset=utf-8"},
    )


@app.after_request
def add_dev_cors_headers(response):
    origin = request.headers.get("Origin", "")
    allowed_origins = {
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
    }
    if origin in allowed_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, OPTIONS"
    return response


@app.before_request
def handle_options_preflight():
    if request.method == "OPTIONS":
        return Response(status=204)


@app.route("/tts", methods=["POST"])
def tts():
    """Convert text to speech (standalone)."""
    text = request.json.get("text", "") if request.is_json else request.form.get("text", "")
    voice_id = request.json.get("voice_id", "") if request.is_json else request.form.get("voice_id", "")
    if not text:
        return jsonify({"error": "No text provided"}), 400
    try:
        audio = text_to_speech_audio(text, voice_id=voice_id)
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
    try:
        description, website_url = resolve_business_description(data)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    scenario = normalize_scenario(data.get("scenario"))
    session["business_description"] = description
    session["website_url"] = website_url
    session["scenario"] = scenario
    session["caller_settings"] = normalize_caller_settings(data)
    session.pop("synced_agent_id", None)
    session.pop("synced_business_description", None)
    session.pop("synced_scenario", None)
    return jsonify({"ok": True, "scenario": scenario, "website_url": website_url, "caller_settings": session["caller_settings"]})


@app.route("/api/tasks/suggest", methods=["POST"])
def suggest_tasks():
    data = request.get_json() or {}
    summary = (data.get("description") or "").strip()
    if not summary:
        return jsonify({"error": "Business summary is required to suggest tasks."}), 400
    tasks = suggest_tasks_from_summary(summary)
    return jsonify({"tasks": tasks})


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
    """Return a signed WebSocket URL and conversation_config_override for ElevenLabs voice."""
    if request.method == "POST":
        data = request.get_json() or {}
    else:
        data = request.args or {}
    request_description = (data.get("description") or "").strip()
    request_website_url = (data.get("website_url") or "").strip()
    if request_description or request_website_url:
        try:
            description, website_url = resolve_business_description(data)
            if website_url:
                session["website_url"] = website_url
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
    else:
        description = get_session_value("business_description")
    scenario = normalize_scenario(data.get("scenario") or get_session_value("scenario"))
    caller_settings = resolve_caller_settings(data)
    if not description:
        return jsonify({"error": "Provide a business summary or website first (use /api/context or pass in request)."}), 400

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

    return jsonify({
        "signed_url": signed_url,
        "conversation_config_override": conversation_config_override.get("conversation_config_override", {}),
    })


@app.route("/api/demo/simulate", methods=["POST"])
def demo_simulate():
    """Simulate a demo conversation between the configured penetration-test agent and a business-side prompt."""
    data = request.get_json() or {}
    try:
        business_description, website_url = resolve_business_description(data)
        if website_url:
            session["website_url"] = website_url
            session["business_description"] = business_description
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    scenario = normalize_scenario(data.get("scenario") or get_session_value("scenario"))
    service_agent_id = (os.getenv("DEMO_AGENT_ID") or "").strip()
    if not service_agent_id:
        return jsonify({"error": "DEMO_AGENT_ID is not set in .env."}), 500
    service_prompt = (data.get("service_prompt") or "").strip()
    service_first_message = (data.get("service_first_message") or "").strip()
    try:
        service_agent = elevenlabs_get(f"/v1/convai/agents/{service_agent_id}")
    except Exception as exc:
        return jsonify({"error": f"Failed to load demo service agent: {exc}"}), 502
    service_conversation_config = service_agent.get("conversation_config") or {}
    service_agent_config = service_conversation_config.get("agent") or {}
    service_prompt = service_prompt or str(
        ((service_agent_config.get("prompt") or {}).get("prompt")) or ""
    ).strip()
    service_first_message = service_first_message or str(service_agent_config.get("first_message") or "").strip()

    service_prompt = build_demo_counterparty_prompt(
        business_description=business_description,
        service_prompt=service_prompt,
    )
    try:
        max_turns = int(data.get("max_turns") or 18)
    except (TypeError, ValueError):
        max_turns = 18
    max_turns = max(4, min(40, max_turns))

    try:
        agent_id = ensure_session_agent_is_synced(business_description, scenario)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 502

    simulation_specification = {
        "simulated_user_config": {
            "prompt": {"prompt": service_prompt},
        },
        "new_turns_limit": max_turns,
    }
    if service_first_message:
        simulation_specification["simulated_user_config"]["first_message"] = service_first_message

    try:
        simulation_response = elevenlabs_post(
            f"/v1/convai/agents/{agent_id}/simulate-conversation",
            {"simulation_specification": simulation_specification},
        )
    except Exception as exc:
        return jsonify({"error": str(exc)}), 502

    transcript = []
    for idx, turn in enumerate(simulation_response.get("simulated_conversation") or [], start=1):
        if not isinstance(turn, dict):
            continue
        role = normalize_status_text(
            turn.get("role") or turn.get("speaker") or turn.get("source") or turn.get("author")
        ) or "unknown"
        text = (
            turn.get("text")
            or turn.get("message")
            or turn.get("content")
            or turn.get("utterance")
            or ""
        )
        text = str(text or "").strip()
        if not text:
            continue
        transcript.append(
            {
                "index": idx,
                "role": role,
                "label": "Penetration Agent" if role == "agent" else "Customer Service Agent",
                "text": text,
                "time_in_call_secs": turn.get("time_in_call_secs"),
            }
        )

    return jsonify(
        {
            "ok": True,
            "agent_id": agent_id,
            "service_agent_id": service_agent_id or None,
            "scenario": scenario,
            "turn_count": len(transcript),
            "transcript": transcript,
            "analysis": simulation_response.get("analysis") or simulation_response.get("conversation_analysis") or {},
            "raw": simulation_response,
        }
    )


@app.route("/api/call", methods=["POST"])
def start_call():
    """Start an outbound phone call through ElevenLabs + Twilio."""
    data = request.get_json() or {}
    to_number = normalize_us_phone_number(data.get("to_number"))
    request_description = (data.get("business_description") or data.get("description") or "").strip()
    request_website_url = (data.get("website_url") or "").strip()
    if request_description or request_website_url:
        try:
            business_description, website_url = resolve_business_description(
                {"description": request_description, "website_url": request_website_url}
            )
            if website_url:
                session["website_url"] = website_url
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
    else:
        business_description = get_session_value("business_description")
    scenario = normalize_scenario(data.get("scenario") or get_session_value("scenario"))
    caller_settings = resolve_caller_settings(data)

    if not business_description:
        return jsonify({"error": "Provide a business summary or website first."}), 400
    if not to_number or not validate_phone_number(to_number):
        return jsonify({"error": "Phone number must be a valid US number (e.g. 5551234567 or +15551234567)."}), 400

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


@app.route("/api/call/batch", methods=["POST"])
def start_batch_calls():
    """Start a strictly sequential batch of outbound calls using task list + randomized caller settings."""
    data = request.get_json() or {}
    to_number = normalize_us_phone_number(data.get("to_number"))
    if not to_number or not validate_phone_number(to_number):
        return jsonify({"error": "Phone number must be a valid US number (e.g. 5551234567 or +15551234567)."}), 400

    try:
        business_description, website_url = resolve_business_description(data)
        if website_url:
            session["website_url"] = website_url
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    raw_count = data.get("num_agents", DEFAULT_BATCH_AGENT_COUNT)
    try:
        num_agents = int(raw_count)
    except (TypeError, ValueError):
        return jsonify({"error": f"num_agents must be an integer between {MIN_BATCH_AGENT_COUNT} and {MAX_BATCH_AGENT_COUNT}."}), 400
    if num_agents < MIN_BATCH_AGENT_COUNT or num_agents > MAX_BATCH_AGENT_COUNT:
        return jsonify({"error": f"num_agents must be between {MIN_BATCH_AGENT_COUNT} and {MAX_BATCH_AGENT_COUNT}."}), 400

    tasks = parse_task_list(data.get("tasks"))
    if not tasks:
        return jsonify({"error": "Provide at least one task in the task list."}), 400

    missing_env = [
        name
        for name in ("ELEVENLABS_API_KEY", "ELEVENLABS_AGENT_ID", "ELEVENLABS_AGENT_PHONE_NUMBER_ID")
        if not os.getenv(name)
    ]
    if missing_env:
        return jsonify({"error": f"Missing required environment variables: {', '.join(missing_env)}"}), 500

    batch_started = time.time()
    voice_ids = get_available_voice_ids_cached()
    results = []
    for idx in range(num_agents):
        task = tasks[idx % len(tasks)]
        entry = {"index": idx + 1, "task": task, "status": "failed"}
        try:
            entry.update(run_single_batch_call(business_description, to_number, task, voice_ids=voice_ids))
        except Exception as exc:
            entry["error"] = str(exc)
        results.append(entry)

    initiated = sum(1 for item in results if item.get("status") != "failed")
    known_duration_total = 0.0
    known_duration_count = 0
    total_issues_detected = 0
    for item in results:
        duration_val = item.get("duration_seconds")
        if duration_val is None:
            pass
        else:
            known_duration_total += float(duration_val)
            known_duration_count += 1
        issues = item.get("issues_detected")
        if isinstance(issues, list):
            total_issues_detected += len(issues)
    return jsonify(
        {
            "ok": initiated > 0,
            "to_number": to_number,
            "num_agents": num_agents,
            "initiated": initiated,
            "failed": num_agents - initiated,
            "total_batch_elapsed_seconds": round(time.time() - batch_started, 2),
            "total_known_call_duration_seconds": round(known_duration_total, 2),
            "known_duration_count": known_duration_count,
            "total_issues_detected": total_issues_detected,
            "results": results,
        }
    )


@app.route("/api/call/batch/one", methods=["POST"])
def start_single_batch_call():
    """Run one randomized test call for a specific task and wait for completion."""
    data = request.get_json() or {}
    to_number = normalize_us_phone_number(data.get("to_number"))
    if not to_number or not validate_phone_number(to_number):
        return jsonify({"error": "Phone number must be a valid US number (e.g. 5551234567 or +15551234567)."}), 400

    task = (data.get("task") or "").strip()
    if not task:
        return jsonify({"error": "Task is required."}), 400
    run_id = (data.get("run_id") or "").strip()

    request_website_url = normalize_website_url(data.get("website_url") or "")
    cached_website_url = session.get("website_url") or ""
    cached_description = session.get("business_description") or ""

    if request_website_url and request_website_url == cached_website_url and cached_description:
        # Reuse the already-fetched business description from /api/context — skip re-fetching the website.
        business_description = cached_description
        website_url = request_website_url
    else:
        try:
            business_description, website_url = resolve_business_description(data)
            if website_url:
                session["website_url"] = website_url
                session["business_description"] = business_description
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

    missing_env = [
        name
        for name in ("ELEVENLABS_API_KEY", "ELEVENLABS_AGENT_ID", "ELEVENLABS_AGENT_PHONE_NUMBER_ID")
        if not os.getenv(name)
    ]
    if missing_env:
        return jsonify({"error": f"Missing required environment variables: {', '.join(missing_env)}"}), 500

    voice_ids = get_available_voice_ids_cached()
    try:
        entry = run_single_batch_call(business_description, to_number, task, voice_ids=voice_ids, run_id=run_id, async_analysis=True)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 502

    return jsonify({"ok": entry.get("status") != "failed", "result": entry})


@app.route("/api/call/batch/one/analysis", methods=["GET"])
def poll_single_batch_analysis():
    """Poll for the async analysis result of a single batch call."""
    analysis_id = request.args.get("id", "").strip()
    if not analysis_id:
        return jsonify({"error": "Missing id parameter."}), 400
    with _pending_analyses_lock:
        result = _pending_analyses.pop(analysis_id, None)
    if result is None:
        return jsonify({"ready": False})
    return jsonify({"ready": True, "result": result})


@app.route("/api/call/batch/cancel", methods=["POST"])
def cancel_batch_calls():
    """Cancel a live penetration-test run and terminate any active calls."""
    data = request.get_json() or {}
    run_id = (data.get("run_id") or "").strip()
    if not run_id:
        return jsonify({"error": "run_id is required."}), 400

    active_calls = _mark_run_cancelled(run_id)
    terminations = []
    for active in active_calls:
        call_sid = (active.get("call_sid") or "").strip()
        conversation_id = (active.get("conversation_id") or "").strip()
        if not call_sid and not conversation_id:
            continue
        terminations.append(
            {
                "call_sid": call_sid,
                "conversation_id": conversation_id,
                "termination": terminate_outbound_call(call_sid=call_sid, conversation_id=conversation_id),
            }
        )

    terminated_ok = sum(
        1
        for item in terminations
        if isinstance(item.get("termination"), dict) and item["termination"].get("ok")
    )
    return jsonify(
        {
            "ok": True,
            "run_id": run_id,
            "cancelled": True,
            "active_calls_seen": len(active_calls),
            "calls_terminated": terminated_ok,
            "terminations": terminations,
        }
    )


if __name__ == "__main__":
    app.run(debug=True, port=3001, use_reloader=False)
