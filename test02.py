import os
from dotenv import load_dotenv
from google.cloud import speech

# Load environment variables from the .env file
load_dotenv()

# Get the GOOGLE_APPLICATION_CREDENTIALS from the environment
google_credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')

# Set the environment variable for Google Cloud authentication
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = google_credentials_path

# Now, proceed with using the Speech-to-Text API
client = speech.SpeechClient()

# Example code to transcribe an audio file
audio_file_path = "mono.wav"
with open(audio_file_path, 'rb') as audio_file:
    content = audio_file.read()

audio = speech.RecognitionAudio(content=content)
config = speech.RecognitionConfig(
    encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
    sample_rate_hertz=44100,
    language_code="en-US",
)

response = client.recognize(config=config, audio=audio)

best_transcript = ""
highest_confidence = 0.0

for result in response.results:
    alternative = result.alternatives[0]
    if alternative.confidence > highest_confidence:
        highest_confidence = alternative.confidence
        best_transcript = alternative.transcript

print("Best Transcript:", best_transcript)
# print("Confidence Score:", highest_confidence)


