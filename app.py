"""
AI Voice Testing Platform - Minimal Backend
Uses ElevenLabs for text-to-speech.
"""
import os
from flask import Flask, render_template, request, Response
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)


@app.route("/")
def index():
    """Serve the simple frontend."""
    return render_template("index.html")


@app.route("/tts", methods=["POST"])
def text_to_speech():
    """Convert text to speech using ElevenLabs."""
    text = request.json.get("text", "") if request.is_json else request.form.get("text", "")
    if not text:
        return {"error": "No text provided"}, 400

    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        return {"error": "ELEVENLABS_API_KEY not set in .env"}, 500

    try:
        from elevenlabs.client import ElevenLabs
        client = ElevenLabs(api_key=api_key)
        audio = client.text_to_speech.convert(
            text=text[:500],  # limit length for demo
            voice_id="JBFqnCBsd6RMkjVDRZzb",  # default voice
            model_id="eleven_turbo_v2_5",
        )
        return Response(
            audio,
            mimetype="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=speech.mp3"},
        )
    except Exception as e:
        return {"error": str(e)}, 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
