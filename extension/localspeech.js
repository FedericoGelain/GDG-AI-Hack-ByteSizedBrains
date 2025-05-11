// Local Speech Recognition implementation
class LocalSpeechRecognitionManager {
  constructor() {
    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.currentTextarea = null;
    this.currentButton = null;
    this.statusElement = document.getElementById('statusMessage');
    
    // API endpoint for your local speech recognition service
    this.apiEndpoint = 'http://localhost:8000/transcribe';
    
    // Check if the server is available
    this.checkServerHealth();
    
    // Log initialization
    console.log('Local Speech Recognition Manager initialized');
    
    // Update system indicator
    this.updateSystemIndicator('Local Speech Recognition (initializing)');
  }
  
  async checkServerHealth() {
    try {
      // Use the same port as your transcribe endpoint
      const response = await fetch('http://localhost:8000/health');
      if (response.ok) {
        const data = await response.json();
        console.log('Server health check:', data);
        this.updateSystemIndicator('Local Speech Recognition (ready)');
        this.showStatus('Speech recognition server is ready');
      } else {
        console.error('Server health check failed:', response.status);
        this.updateSystemIndicator('Local Speech Recognition (server error)');
        this.showStatus('Speech recognition server is not responding properly');
      }
    } catch (error) {
      console.error('Error checking server health:', error);
      this.updateSystemIndicator('Local Speech Recognition (server unavailable)');
      this.showStatus('Cannot connect to speech recognition server. Make sure it is running at http://localhost:8000');
    }
  }
  
  updateSystemIndicator(system) {
    const systemIndicator = document.getElementById('recognitionSystemIndicator');
    if (systemIndicator) {
      systemIndicator.textContent = `Using: ${system}`;
    }
  }
  
  async start(textarea, button) {
    console.log('Starting local speech recognition...');
    
    if (this.isRecording) {
      console.log('Already recording, stopping first');
      this.stop();
      return;
    }

    if (!textarea) {
      console.error('No textarea provided to speech recognition');
      this.showStatus('Error: No text field selected');
      return;
    }

    this.currentTextarea = textarea;
    this.currentButton = button;
    this.audioChunks = [];
    
    try {
      // Request microphone access
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
          sampleRate: 48000
        }
      });
      
      console.log('Microphone access granted, creating MediaRecorder...');
      
      // Create media recorder with explicit MIME type
      try {
        this.mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        });
      } catch (e) {
        console.warn('audio/webm;codecs=opus not supported, trying audio/webm');
        this.mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm'
        });
      }
      
      console.log('MediaRecorder created with mimeType:', this.mediaRecorder.mimeType);
      
      // Set up data handler
      this.mediaRecorder.ondataavailable = (event) => {
        console.log('Data available event, size:', event.data.size);
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      
      // Set up stop handler
      this.mediaRecorder.onstop = async () => {
        console.log('MediaRecorder stopped, chunks collected:', this.audioChunks.length);
        
        // Change from recording to processing state
        if (this.currentButton) {
          this.currentButton.classList.remove('listening');
          this.currentButton.classList.add('processing');
        }
        
        this.showStatus('Processing audio...');
        
        await this.processAudio();
        this.isRecording = false;
        
        // Clean up
        stream.getTracks().forEach(track => track.stop());
        
        // Update UI
        if (this.currentButton) {
          this.currentButton.classList.remove('processing');
        }
      };
      
      // Start recording
      this.mediaRecorder.start(1000); // Collect data every second
      console.log('MediaRecorder started');
      
      // Update state and UI
      this.isRecording = true;
      
      if (this.currentButton) {
        this.currentButton.classList.add('listening');
      }
      
      this.showStatus('Recording... Click mic again to stop', true);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      this.showStatus('Error: ' + error.message);
    }
  }
  
  async processAudio() {
    try {
      this.showStatus('Processing audio...');
      
      // Create audio blob
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      console.log('Audio blob created, size:', audioBlob.size, 'bytes');
      
      if (audioBlob.size === 0) {
        this.showStatus('No audio recorded');
        if (this.currentButton) {
          this.currentButton.classList.remove('processing');
        }
        return;
      }
      
      // Prepare form data for upload
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      // Send to backend
      console.log('Sending audio to server:', this.apiEndpoint);
      this.showStatus('Sending audio to server...');
      
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', this.apiEndpoint, true);
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const result = JSON.parse(xhr.responseText);
              console.log('Server response:', result);
              
              if (result.error) {
                this.showStatus(`Server Error: ${result.error}`);
                if (this.currentButton) {
                  this.currentButton.classList.remove('processing');
                }
                reject(new Error(result.error));
              } else if (result.transcript) {
                // Add transcript to textarea
                if (this.currentTextarea) {
                  // Append with proper spacing
                  const currentText = this.currentTextarea.value;
                  const spacer = currentText && !currentText.endsWith(' ') ? ' ' : '';
                  this.currentTextarea.value += spacer + result.transcript;
                  
                  // Focus the textarea and move cursor to end
                  this.currentTextarea.focus();
                  this.currentTextarea.selectionStart = this.currentTextarea.value.length;
                  this.currentTextarea.selectionEnd = this.currentTextarea.value.length;
                  
                  // Auto-submit after a short delay
                  setTimeout(() => {
                    // Click the appropriate action button based on which textarea we're using
                    if (this.currentTextarea.id === 'userPrompt') {
                      const submitButton = document.getElementById('modifyButton');
                      if (submitButton) submitButton.click();
                    } else if (this.currentTextarea.id === 'userQuestion') {
                      const submitButton = document.getElementById('askButton');
                      if (submitButton) submitButton.click();
                    }
                  }, 500); // Half-second delay to let user see what was transcribed
                }
                
                // Remove processing state
                if (this.currentButton) {
                  this.currentButton.classList.remove('processing');
                }
                
                this.showStatus('Transcription complete', false); // Don't show submit button since we're auto-submitting
                resolve(result);
              } else {
                if (this.currentButton) {
                  this.currentButton.classList.remove('processing');
                }
                this.showStatus('No transcript returned from server');
                reject(new Error('No transcript returned'));
              }
            } catch (e) {
              console.error('Error parsing response:', e);
              if (this.currentButton) {
                this.currentButton.classList.remove('processing');
              }
              this.showStatus('Error parsing response: ' + e.message);
              reject(e);
            }
          } else {
            console.error('XHR error:', xhr.status, xhr.statusText);
            if (this.currentButton) {
              this.currentButton.classList.remove('processing');
            }
            this.showStatus(`Server error: ${xhr.status} ${xhr.statusText}`);
            reject(new Error(`XHR error: ${xhr.status} ${xhr.statusText}`));
          }
        };
        
        xhr.onerror = (e) => {
          console.error('Network error:', e);
          if (this.currentButton) {
            this.currentButton.classList.remove('processing');
          }
          this.showStatus('Network error connecting to server');
          reject(new Error('Network error'));
        };
        
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            this.showStatus(`Uploading: ${percentComplete}%`);
          }
        };
        
        // Send the request
        xhr.send(formData);
      });
    } catch (error) {
      console.error('Error processing audio:', error);
      if (this.currentButton) {
        this.currentButton.classList.remove('processing');
      }
      this.showStatus('Error processing audio: ' + error.message);
    }
  }
  
  stop() {
    console.log('Stopping local speech recognition...');
    
    if (!this.isRecording) {
      console.log('Not recording, nothing to stop');
      return;
    }
    
    console.log('Setting isRecording to false');
    this.isRecording = false;
    
    // Stop media recorder if it's running
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      console.log('Stopping MediaRecorder, current state:', this.mediaRecorder.state);
      try {
        this.mediaRecorder.stop();
        console.log('MediaRecorder stopped successfully');
      } catch (e) {
        console.error('Error stopping MediaRecorder:', e);
        
        // Make sure we clean up the UI even if there's an error
        if (this.currentButton) {
          this.currentButton.classList.remove('listening');
          this.currentButton.classList.remove('processing');
        }
      }
    } else {
      console.log('MediaRecorder not active, just updating UI');
      // If mediaRecorder is not active, still update UI
      if (this.currentButton) {
        this.currentButton.classList.remove('listening');
        this.currentButton.classList.remove('processing');
      }
    }
  }
  
  showStatus(message, showSubmitButton = false) {
    console.log('Status message:', message);
    
    if (!this.statusElement) {
      console.error('Status element not found');
      return;
    }
    
    // Clear previous content
    this.statusElement.innerHTML = '';
    
    // Add message
    const messageElement = document.createElement('span');
    messageElement.textContent = message;
    this.statusElement.appendChild(messageElement);
    
    // Add submit button if requested
    if (showSubmitButton && this.currentTextarea) {
      const submitButton = document.createElement('button');
      submitButton.textContent = 'Submit';
      submitButton.className = 'small-button submit-button';
      submitButton.addEventListener('click', () => {
        this.stop();
        
        // Click the appropriate action button
        if (this.currentTextarea.id === 'userPrompt') {
          document.getElementById('modifyButton').click();
        } else if (this.currentTextarea.id === 'userQuestion') {
          document.getElementById('askButton').click();
        }
      });
      
      this.statusElement.appendChild(submitButton);
    }
    
    this.statusElement.style.display = 'flex';
  }

  hideStatus() {
    if (this.statusElement) {
      this.statusElement.style.display = 'none';
    }
  }

  isSupported() {
    return navigator.mediaDevices && 
           navigator.mediaDevices.getUserMedia && 
           window.MediaRecorder;
  }
}

// Export the manager
window.LocalSpeechRecognitionManager = LocalSpeechRecognitionManager; 