// Speech recognition functionality
let recognition;
let isListening = false;

// Initialize speech recognition
function initSpeechRecognition() {
  if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onstart = function() {
      isListening = true;
      document.getElementById('micButton').classList.add('listening');
      updateStatus('Listening...');
    };
    
    recognition.onresult = function(event) {
      let transcript = '';
      let isFinal = false;
      
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
        isFinal = event.results[i].isFinal;
      }
      
      document.getElementById('transcript').textContent = transcript;
      
      if (isFinal) {
        stopSpeechRecognition();
        
        // Send the transcript back to the popup
        chrome.runtime.sendMessage({
          action: 'speechResult',
          transcript: transcript
        });
        
        // Close this window after a short delay
        setTimeout(() => {
          window.close();
        }, 1000);
      }
    };
    
    recognition.onerror = function(event) {
      console.error('Speech recognition error:', event.error);
      updateStatus('Error: ' + event.error);
      stopSpeechRecognition();
    };
    
    recognition.onend = function() {
      stopSpeechRecognition();
    };
    
    return true;
  } else {
    updateStatus('Speech recognition not supported in this browser');
    return false;
  }
}

// Start speech recognition
function startSpeechRecognition() {
  if (!recognition) {
    if (!initSpeechRecognition()) {
      return;
    }
  }
  
  // If already listening, stop first
  if (isListening) {
    stopSpeechRecognition();
    return;
  }
  
  try {
    recognition.start();
  } catch (e) {
    console.error('Error starting speech recognition:', e);
    updateStatus('Error starting speech recognition');
  }
}

// Stop speech recognition
function stopSpeechRecognition() {
  if (recognition && isListening) {
    try {
      recognition.stop();
    } catch (e) {
      console.error('Error stopping speech recognition:', e);
    }
  }
  
  isListening = false;
  document.getElementById('micButton').classList.remove('listening');
  updateStatus('Click the microphone to start speaking');
}

// Update status message
function updateStatus(message) {
  document.getElementById('status').textContent = message;
}

// Get parameters from URL
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    type: params.get('type') || 'prompt'
  };
}

// Document ready
document.addEventListener('DOMContentLoaded', function() {
  const micButton = document.getElementById('micButton');
  
  micButton.addEventListener('click', function() {
    startSpeechRecognition();
  });
  
  // Get URL parameters
  const params = getUrlParams();
  
  // Update UI based on type
  if (params.type === 'question') {
    document.querySelector('h1').textContent = 'Ask a Question';
  } else {
    document.querySelector('h1').textContent = 'Modify Page';
  }
});

// Web Speech API implementation
class SpeechRecognitionManager {
  constructor() {
    this.recognition = null;
    this.isRecording = false;
    this.currentTextarea = null;
    this.currentButton = null;
    this.statusElement = document.getElementById('statusMessage');
    
    // Initialize Web Speech API
    this.initRecognition();
  }
  
  initRecognition() {
    if (!this.isSupported()) {
      console.error('Web Speech API not supported in this browser');
      this.showStatus('Speech recognition not supported in this browser');
      return;
    }
    
    this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    
    this.recognition.onresult = (event) => {
      if (!this.currentTextarea) return;
      
      let interimTranscript = '';
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      if (finalTranscript) {
        this.currentTextarea.value += ' ' + finalTranscript;
      }
      
      if (interimTranscript) {
        this.showStatus('Hearing: ' + interimTranscript);
      }
    };
    
    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      this.showStatus('Error: ' + event.error);
      this.isRecording = false;
      if (this.currentButton) {
        this.currentButton.classList.remove('listening');
      }
    };
    
    this.recognition.onend = () => {
      if (this.isRecording) {
        // If we're still supposed to be recording, restart
        try {
          this.recognition.start();
        } catch (e) {
          console.error('Error restarting recognition:', e);
          this.isRecording = false;
          if (this.currentButton) {
            this.currentButton.classList.remove('listening');
          }
          this.showStatus('Recognition stopped: ' + e.message);
        }
      } else {
        // Otherwise update UI
        if (this.currentButton) {
          this.currentButton.classList.remove('listening');
        }
        this.showStatus('Transcription complete', true);
      }
    };
    
    console.log('Web Speech API initialized');
  }
  
  async start(textarea, button) {
    console.log('Starting speech recognition...');
    
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
    
    if (!this.recognition) {
      this.initRecognition();
      if (!this.recognition) {
        this.showStatus('Error: Could not initialize speech recognition');
        return;
      }
    }

    this.currentTextarea = textarea;
    this.currentButton = button;
    
    try {
      // Request microphone access
      console.log('Requesting microphone access...');
      await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone access granted');
      
      // Start recognition
      this.recognition.start();
      this.isRecording = true;
      
      // Update UI
      if (this.currentButton) {
        this.currentButton.classList.add('listening');
      }
      
      this.showStatus('Recording... Click mic again to stop', true);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      this.showStatus('Error: ' + error.message);
    }
  }
  
  stop() {
    console.log('Stopping speech recognition...');
    
    if (!this.isRecording) {
      console.log('Not recording, nothing to stop');
      return;
    }
    
    this.isRecording = false;
    
    // Stop recognition
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.error('Error stopping recognition:', e);
      }
    }
    
    // Update UI
    if (this.currentButton) {
      this.currentButton.classList.remove('listening');
    }
    
    this.showStatus('Transcription complete', true);
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
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }
}

// Export the manager
window.SpeechRecognitionManager = SpeechRecognitionManager; 