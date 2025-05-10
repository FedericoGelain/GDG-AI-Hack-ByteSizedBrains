import os
from flask import Flask, request, jsonify
from google.cloud import speech
from dotenv import load_dotenv
from io import BytesIO

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Set up Google Cloud credentials
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')

# Google Cloud Speech Client
client = speech.SpeechClient()

@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400

    audio_file = request.files['audio']
    audio_content = audio_file.read()

    # Use Google Cloud Speech-to-Text API
    audio = speech.RecognitionAudio(content=audio_content)
    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
        sample_rate_hertz=44100,
        language_code="en-US"
    )

    response = client.recognize(config=config, audio=audio)

    best_transcript = ""
    highest_confidence = 0.0

    for result in response.results:
        alternative = result.alternatives[0]
        if alternative.confidence > highest_confidence:
            highest_confidence = alternative.confidence
            best_transcript = alternative.transcript

    return jsonify({'transcript': best_transcript})

if __name__ == '__main__':
    app.run(debug=True)
