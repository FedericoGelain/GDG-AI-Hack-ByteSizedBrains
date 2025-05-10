import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from google.cloud import speech
from dotenv import load_dotenv
from io import BytesIO
from pydub import AudioSegment  # Requires ffmpeg
import tempfile

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Set up Google Cloud credentials
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')

# Google Cloud Speech Client
client = speech.SpeechClient()

@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400

    try:
        audio_file = request.files['audio']
        
        # Create temporary file for conversion
        with tempfile.NamedTemporaryFile(suffix='.webm') as tmp:
            audio_file.save(tmp.name)
            
            # Convert webm to wav with correct parameters
            audio = AudioSegment.from_file(tmp.name, format="webm")
            
            # Set to mono channel and 48kHz sample rate
            audio = audio.set_channels(1)
            audio = audio.set_frame_rate(48000)
            
            # Export to WAV format with 16-bit depth
            wav_io = BytesIO()
            audio.export(wav_io, format="wav",
                        codec="pcm_s16le",
                        parameters=["-ac", "1", "-ar", "48000"])
            
            audio_content = wav_io.getvalue()

        # Use Google Cloud Speech-to-Text API
        audio_config = speech.RecognitionAudio(content=audio_content)
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=48000,  # Match the converted sample rate
            language_code="en-US"
        )

        response = client.recognize(config=config, audio=audio_config)

        best_transcript = ""
        highest_confidence = 0.0

        for result in response.results:
            alternative = result.alternatives[0]
            if alternative.confidence > highest_confidence:
                highest_confidence = alternative.confidence
                best_transcript = alternative.transcript

        return jsonify({'transcript': best_transcript})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)