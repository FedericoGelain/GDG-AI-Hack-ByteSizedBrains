document.getElementById('startBtn').addEventListener('click', async () => {
  const status = document.getElementById('status');
  const button = document.getElementById('startBtn');
  
  try {
    button.disabled = true;
    status.textContent = 'Requesting microphone access...';
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    status.textContent = 'Recording (5 seconds)...';
    status.style.color = 'green';

    const mediaRecorder = new MediaRecorder(stream);
    let audioChunks = [];

    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    
    mediaRecorder.onstop = async () => {
      try {
        status.textContent = 'Processing audio...';
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        
        // Prepare form data for upload
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        // Send to backend
        const response = await fetch('http://localhost:5000/transcribe', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const result = await response.json();
        
        if (result.error) {
          status.textContent = `Server Error: ${result.error}`;
        } else {
          status.innerHTML = `Transcript: <strong>${result.transcript}</strong>`;
        }
        
      } catch (error) {
        status.textContent = `❌ Processing failed: ${error.message}`;
        console.error('Upload error:', error);
      } finally {
        stream.getTracks().forEach(track => track.stop());
        button.disabled = false;
      }
    };

    mediaRecorder.start();
    setTimeout(() => mediaRecorder.stop(), 5000);

  } catch (error) {
    status.textContent = `❌ Error: ${error.name}`;
    status.style.color = 'red';
    button.disabled = false;
    
    if (error.name === 'NotAllowedError') {
      status.textContent += ' - Allow microphone access in browser settings';
    }
  }
});