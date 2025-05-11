import os
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import speech_v1p1beta1 as speech
from dotenv import load_dotenv
import tempfile
from pydub import AudioSegment
import logging
import asyncio
from typing import Dict, Any
import shutil
import sys

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Set up Google Cloud credentials
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
if not os.path.exists(os.environ["GOOGLE_APPLICATION_CREDENTIALS"]):
    logger.warning(f"Credentials file not found: {os.environ['GOOGLE_APPLICATION_CREDENTIALS']}")

# Create FastAPI app
app = FastAPI(title="Speech Recognition API", 
              description="API for transcribing audio using Google Cloud Speech-to-Text",
              version="1.0.0")

# Add CORS middleware with more specific settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*", "chrome-extension://"],  # Allow Chrome extensions
    allow_credentials=False,  # Don't require credentials
    allow_methods=["GET", "POST", "OPTIONS"],  # Specify methods
    allow_headers=["*"],  # Allow all headers
    expose_headers=["Content-Type", "Content-Length"],
    max_age=86400,  # Cache preflight requests for 1 day
)

# Initialize Google Cloud Speech client
client = speech.SpeechClient()

# Add this function to check for FFmpeg
def check_ffmpeg():
    """Check if FFmpeg is installed and available in the PATH"""
    if not shutil.which('ffmpeg') or not shutil.which('ffprobe'):
        logger.error("FFmpeg or ffprobe not found. Please install FFmpeg.")
        logger.error("Ubuntu/Debian: sudo apt install ffmpeg")
        logger.error("macOS: brew install ffmpeg")
        logger.error("Windows: Download from https://ffmpeg.org/download.html and add to PATH")
        return False
    return True

@app.post("/transcribe", response_model=Dict[str, Any])
async def transcribe_audio(audio: UploadFile = File(...)):
    """
    Transcribe audio file using Google Cloud Speech-to-Text API.
    
    Args:
        audio: Audio file to transcribe (webm format)
        
    Returns:
        JSON response with transcript or error
    """
    # Check for FFmpeg first
    if not check_ffmpeg():
        return {"error": "FFmpeg not installed. Please install FFmpeg to process audio."}
        
    try:
        logger.info(f"Received audio file: {audio.filename}, content_type: {audio.content_type}")
        logger.info(f"Headers: {dict(audio.headers)}")
        
        # Create temporary file for conversion
        with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as tmp:
            tmp_path = tmp.name
            # Write uploaded file to temp file
            content = await audio.read()
            logger.info(f"Audio content size: {len(content)} bytes")
            tmp.write(content)
        
        logger.info(f"Audio saved to temporary file: {tmp_path}")
        
        try:
            # Convert webm to wav with correct parameters
            try:
                audio_segment = AudioSegment.from_file(tmp_path, format="webm")
            except Exception as e:
                logger.error(f"Error loading audio file: {e}")
                return {"error": f"Error loading audio file: {e}"}
            
            # Set to mono channel and 48kHz sample rate
            audio_segment = audio_segment.set_channels(1)
            audio_segment = audio_segment.set_frame_rate(48000)
            
            # Export to WAV format with 16-bit depth
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as wav_tmp:
                wav_path = wav_tmp.name
            
            try:
                audio_segment.export(wav_path, format="wav",
                            codec="pcm_s16le",
                            parameters=["-ac", "1", "-ar", "48000"])
            except Exception as e:
                logger.error(f"Error exporting to WAV: {e}")
                return {"error": f"Error exporting to WAV: {e}"}
            
            logger.info(f"Audio converted to WAV: {wav_path}")
            
            # Read the WAV file
            with open(wav_path, 'rb') as wav_file:
                audio_content = wav_file.read()
            
            # Use Google Cloud Speech-to-Text API with enhanced model
            audio_config = speech.RecognitionAudio(content=audio_content)
            config = speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
                sample_rate_hertz=48000,
                language_code="en-US",
                model="latest_long",  # Use the latest long-form model
                enable_automatic_punctuation=True,
                use_enhanced=True,
                audio_channel_count=1
            )

            # Run speech recognition
            operation = client.recognize(config=config, audio=audio_config)
            
            # Process results
            best_transcript = ""
            highest_confidence = 0.0

            for result in operation.results:
                alternative = result.alternatives[0]
                if hasattr(alternative, 'confidence') and alternative.confidence > highest_confidence:
                    highest_confidence = alternative.confidence
                    best_transcript = alternative.transcript
                elif not hasattr(alternative, 'confidence'):
                    # If no confidence score, just use this transcript
                    best_transcript = alternative.transcript

            logger.info(f"Transcription successful: {best_transcript[:30]}...")
            return {"transcript": best_transcript}

        finally:
            # Clean up temporary files
            try:
                os.unlink(tmp_path)
                if 'wav_path' in locals():
                    os.unlink(wav_path)
            except Exception as e:
                logger.error(f"Error cleaning up temporary files: {e}")

    except Exception as e:
        logger.error(f"Error processing audio: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

# Add a preflight handler for OPTIONS requests
@app.options("/transcribe")
async def options_transcribe():
    return {}  # Return empty response with appropriate CORS headers

@app.post("/test-upload")
async def test_upload(audio: UploadFile = File(...)):
    """Simple test endpoint that just returns file info without processing"""
    try:
        content = await audio.read()
        return {
            "filename": audio.filename,
            "content_type": audio.content_type,
            "size": len(content),
            "headers": dict(audio.headers),
            "success": True
        }
    except Exception as e:
        logger.error(f"Error in test upload: {e}")
        return {"error": str(e)}

@app.post("/echo-audio")
async def echo_audio(audio: UploadFile = File(...)):
    """Simple endpoint that just echoes back audio file info without processing"""
    try:
        content = await audio.read()
        return {
            "transcript": "This is a test transcript (FFmpeg not required)",
            "filename": audio.filename,
            "content_type": audio.content_type,
            "size": len(content),
            "headers": dict(audio.headers),
            "success": True
        }
    except Exception as e:
        logger.error(f"Error in echo audio: {e}")
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)