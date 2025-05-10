document.addEventListener("DOMContentLoaded", () => {
  document.getElementById('recordBtn').addEventListener('click', startRecording);
});

let mediaRecorder;
let audioChunks = [];

async function startRecording() {
  try {
      // Will trigger permission prompt on first call
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Microphone access granted – proceed to record
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = event => {
          audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          const formData = new FormData();
          formData.append('audio', audioBlob, 'audio.wav');

          try {
              const response = await fetch('http://localhost:5000/transcribe', {
                  method: 'POST',
                  body: formData
              });

              const data = await response.json();
              document.getElementById('transcript').innerText = "Transcript: " + data.transcript;
          } catch (err) {
              document.getElementById('transcript').innerText = "Server error.";
              console.error(err);
          }
      };

      mediaRecorder.start();
      setTimeout(() => mediaRecorder.stop(), 5000);

  } catch (err) {
      // Permission denied or dismissed
      alert("Please allow microphone access to use this feature.");
      console.error("getUserMedia error:", err);
  }
}

