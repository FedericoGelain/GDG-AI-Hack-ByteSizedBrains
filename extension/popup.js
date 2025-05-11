window.onerror = function(message, source, lineno, colno, error) {
  console.error('Error:', message, 'at', source, 'line', lineno, 'column', colno);
  alert('Error: ' + message);
  return true;
};

// Define showStatus function globally so it can be used anywhere
function showStatus(message, showSubmitButton = false, tabId = 'modify') {
  const statusElement = document.getElementById(`${tabId}StatusMessage`);
  if (!statusElement) {
    console.error(`Status element for ${tabId} not found`);
    return;
  }
  
  // Clear previous content
  statusElement.innerHTML = '';
  
  // Add message
  const messageElement = document.createElement('span');
  messageElement.textContent = message;
  statusElement.appendChild(messageElement);
  
  // Add submit button if requested
  if (showSubmitButton && window.currentTextarea) {
    const submitButton = document.createElement('button');
    submitButton.textContent = 'Submit';
    submitButton.className = 'small-button submit-button';
    submitButton.addEventListener('click', () => {
      // Click the appropriate action button
      if (window.currentTextarea.id === 'userPrompt') {
        document.getElementById('modifyButton').click();
      } else if (window.currentTextarea.id === 'userQuestion') {
        document.getElementById('askButton').click();
      }
    });
    
    statusElement.appendChild(submitButton);
  }
  
  statusElement.style.display = 'flex';
}

function hideStatus(tabId = 'modify') {
  const statusElement = document.getElementById(`${tabId}StatusMessage`);
  if (statusElement) {
    statusElement.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup loaded');
  
  // Set up tabs
  setupTabs();
  
  // Load prompt history
  loadPromptHistory();
  
  // Set up API key management
  setupApiKeyManager();
  
  // Set up the Ask button
  setupAskButton();
  
  // Track current mic button and textarea globally
  window.currentMicButton = null;
  window.currentTextarea = null;
  
  // Function to set loading state on a button
  function setButtonLoading(button, isLoading) {
    if (isLoading) {
      button.classList.add('loading');
      button.disabled = true;
    } else {
      button.classList.remove('loading');
      button.disabled = false;
    }
  }
  
  // Function to request microphone permission using the permission.html iframe
  function requestMicrophonePermissionViaIframe() {
    return new Promise((resolve, reject) => {
      console.log('[popup.js] Requesting microphone permission');
      
      // First try to directly request permission
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          console.log('[popup.js] Permission granted directly');
          // Stop all tracks to release the microphone
          stream.getTracks().forEach(track => track.stop());
          resolve();
        })
        .catch(error => {
          console.log('[popup.js] Direct permission failed:', error);
          
          // Show a message to the user
          showStatus('Microphone permission required. Please click "Grant Microphone Permission" button below.', false);
          
          // Don't automatically open the permission page, let the user click the button
          reject(new Error('Microphone permission required. Please use the "Grant Microphone Permission" button.'));
        });
    });
  }
  
  // Function to set up tabs
  function setupTabs() {
    const tabs = document.querySelectorAll('.tab-button');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Remove active class from all tabs
        tabs.forEach(t => t.classList.remove('active'));
        
        // Add active class to clicked tab
        tab.classList.add('active');
        
        // Hide all tab content
        const panels = document.querySelectorAll('.panel');
        panels.forEach(panel => panel.classList.remove('active'));
        
        // Show the corresponding tab content
        const tabName = tab.getAttribute('data-tab');
        const tabContent = document.getElementById(tabName + 'Tab');
        if (tabContent) {
          tabContent.classList.add('active');
        }
        
        // Refresh history if history tab is selected
        if (tabName === 'history') {
          loadPromptHistory();
        }
      });
    });
  }
  
  // History management functions
  function savePromptToHistory(prompt) {
    chrome.storage.local.get(['promptHistory'], function(result) {
      let history = result.promptHistory || [];
      
      // Add timestamp to the prompt
      const promptWithTimestamp = {
        text: prompt,
        timestamp: new Date().toISOString()
      };
      
      // Add to beginning of array (most recent first)
      history.unshift(promptWithTimestamp);
      
      // Keep only the last 20 prompts
      if (history.length > 20) {
        history = history.slice(0, 20);
      }
      
      // Save back to storage
      chrome.storage.local.set({ promptHistory: history }, function() {
        console.log('Prompt saved to history');
      });
    });
  }
  
  function loadPromptHistory() {
    const historyList = document.getElementById('promptHistory');
    if (!historyList) return;
    
    chrome.storage.local.get(['promptHistory'], function(result) {
      const history = result.promptHistory || [];
      
      // Clear the list
      historyList.innerHTML = '';
      
      if (history.length === 0) {
        const emptyMessage = document.createElement('li');
        emptyMessage.className = 'empty-message';
        emptyMessage.textContent = 'No history yet';
        historyList.appendChild(emptyMessage);
        return;
      }
      
      // Add each prompt to the list
      history.forEach(item => {
        const listItem = document.createElement('li');
        
        // Format the date
        const date = new Date(item.timestamp);
        const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Truncate long prompts
        const maxLength = 50;
        const displayText = item.text.length > maxLength 
          ? item.text.substring(0, maxLength) + '...' 
          : item.text;
        
        listItem.textContent = displayText;
        listItem.title = item.text + ' (' + formattedDate + ')';
        
        // Add click handler to use this prompt
        listItem.addEventListener('click', function() {
          const promptTextarea = document.getElementById('userPrompt');
          promptTextarea.value = item.text;
          
          // Switch to modify tab
          document.querySelector('.tab-button[data-tab="modify"]').click();
          
          // Focus the textarea
          promptTextarea.focus();
        });
        
        historyList.appendChild(listItem);
      });
    });
  }
  
  // Use Local Speech Recognition
  let speechManager = null;
  
  // Load the Local Speech Recognition implementation
  const speechScript = document.createElement('script');
  speechScript.src = chrome.runtime.getURL('localspeech.js');
  speechScript.onload = function() {
    try {
      // Create the Local Speech Recognition manager
      speechManager = new LocalSpeechRecognitionManager();
      
      // Set up the buttons
      setupMicButtons();
    } catch (error) {
      console.error('Error initializing Local Speech Recognition:', error);
      showStatus('Error initializing speech recognition: ' + error.message);
    }
  };
  document.head.appendChild(speechScript);
  
  // Function to set up mic buttons
  function setupMicButtons() {
    const modifyMicButton = document.getElementById('modifyMicButton');
    const questionMicButton = document.getElementById('questionMicButton');
    
    if (!modifyMicButton || !questionMicButton) {
      console.error('Mic buttons not found');
      return;
    }
    
    // Set up click handlers for the mic buttons
    modifyMicButton.addEventListener('click', function() {
      console.log('[popup.js] Modify mic button clicked');
      const textarea = document.getElementById('userPrompt');
      window.currentTextarea = textarea;
      window.currentMicButton = modifyMicButton;
      
      // If already recording or processing, stop
      if (modifyMicButton.classList.contains('listening') || 
          modifyMicButton.classList.contains('processing')) {
        if (speechManager) {
          speechManager.stop();
        }
        return;
      }
      
      // Request microphone permission through iframe
      requestMicrophonePermissionViaIframe()
        .then(() => {
          console.log('[popup.js] Permission granted, starting speech recognition');
          if (speechManager) {
            speechManager.start(textarea, modifyMicButton);
          } else {
            console.log('[popup.js] No speech manager, using content script');
            startContentScriptSpeechRecognition(textarea);
          }
        })
        .catch(error => {
          console.error('[popup.js] Permission error:', error);
          showStatus(`Microphone permission required: ${error.message}`, false, 'modify');
          if (window.currentMicButton) {
            window.currentMicButton.classList.add('permission-denied');
          }
        });
    });
    
    questionMicButton.addEventListener('click', function() {
      console.log('[popup.js] Question mic button clicked');
      const textarea = document.getElementById('userQuestion');
      window.currentTextarea = textarea;
      window.currentMicButton = questionMicButton;
      
      // If already recording or processing, stop
      if (questionMicButton.classList.contains('listening') || 
          questionMicButton.classList.contains('processing')) {
        if (speechManager) {
          speechManager.stop();
        }
        return;
      }
      
      // Request microphone permission through iframe
      requestMicrophonePermissionViaIframe()
        .then(() => {
          console.log('[popup.js] Permission granted, starting speech recognition');
          if (speechManager) {
            speechManager.start(textarea, questionMicButton);
          } else {
            console.log('[popup.js] No speech manager, using content script');
            startContentScriptSpeechRecognition(textarea);
          }
        })
        .catch(error => {
          console.error('[popup.js] Permission error:', error);
          showStatus(`Microphone permission required: ${error.message}`, false, 'ask');
          if (window.currentMicButton) {
            window.currentMicButton.classList.add('permission-denied');
          }
        });
    });
  }
  
  // Add this function to your popup.js
  function startContentScriptSpeechRecognition(textarea) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'startSpeechRecognition' }, (response) => {
          if (chrome.runtime.lastError) {
            showStatus(`Error: ${chrome.runtime.lastError.message}`);
            return;
          }
          
          if (response && response.success && response.transcript) {
            // Add transcript to textarea
            const currentText = textarea.value;
            const spacer = currentText && !currentText.endsWith(' ') ? ' ' : '';
            textarea.value += spacer + response.transcript;
            
            // Focus the textarea and move cursor to end
            textarea.focus();
            textarea.selectionStart = textarea.value.length;
            textarea.selectionEnd = textarea.value.length;
            
            const tabId = textarea.id === 'userPrompt' ? 'modify' : 'ask';
            showStatus('Transcription complete', true, tabId);
          } else if (response && response.error) {
            const tabId = textarea.id === 'userPrompt' ? 'modify' : 'ask';
            showStatus(`Error: ${response.error}`, false, tabId);
          }
        });
      } else {
        showStatus('No active tab found');
      }
    });
  }
  
  // Set up the main action buttons
  const modifyButton = document.getElementById('modifyButton');
  const askButton = document.getElementById('askButton');
  
  if (modifyButton) {
    modifyButton.addEventListener('click', function() {
      const prompt = document.getElementById('userPrompt').value.trim();
      if (!prompt) {
        showStatus('Please enter a description of how you want to modify the page.', false, 'modify');
        return;
      }
      
      // Set button to loading state
      setButtonLoading(modifyButton, true);
      
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs && tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { 
            action: 'modifyPage', 
            prompt: prompt 
          }, function(response) {
            // Reset loading state
            setButtonLoading(modifyButton, false);
            
            if (chrome.runtime.lastError) {
              showStatus(`Error: ${chrome.runtime.lastError.message}`, false, 'modify');
              return;
            }
            
            if (response && response.success) {
              // Save the successful prompt to history
              savePromptToHistory(prompt);
              showStatus('Page modification in progress...', false, 'modify');
            } else if (response && response.error) {
              showStatus(`Error: ${response.error}`, false, 'modify');
            }
          });
        } else {
          setButtonLoading(modifyButton, false);
          showStatus('No active tab found', false, 'modify');
        }
      });
    });
  }
  
  // Add this function to handle the Ask button click
  function setupAskButton() {
    const askButton = document.getElementById('askButton');
    const userQuestion = document.getElementById('userQuestion');
    const answerContainer = document.querySelector('.answer-container');
    const answerText = document.querySelector('.answer-text');
    
    if (!askButton || !userQuestion) {
      console.error('Ask button or question input not found');
      return;
    }
    
    askButton.addEventListener('click', function() {
      const question = userQuestion.value.trim();
      if (!question) {
        showStatus('Please enter a question', false, 'ask');
        return;
      }
      
      // Save to history
      savePromptToHistory(question, 'question');
      
      // Set button to loading state
      setButtonLoading(askButton, true);
      
      // Hide previous answer if any
      if (answerContainer) {
        answerContainer.style.display = 'none';
      }
      
      // Show status
      showStatus('Asking question...', false, 'ask');
      
      // Send message to content script
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs && tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { 
            action: 'askQuestion', 
            question: question 
          }, function(response) {
            // Reset loading state
            setButtonLoading(askButton, false);
            
            if (chrome.runtime.lastError) {
              console.error('Error sending message:', chrome.runtime.lastError);
              showStatus(`Error: ${chrome.runtime.lastError.message}`, false, 'ask');
              return;
            }
            
            if (response && response.success) {
              // If we got a direct answer
              if (response.answer) {
                hideStatus('ask');
                if (answerContainer && answerText) {
                  answerText.textContent = response.answer;
                  answerContainer.style.display = 'block';
                }
              } else {
                showStatus('Processing your question...', false, 'ask');
              }
            } else if (response && response.error) {
              showStatus(`Error: ${response.error}`, false, 'ask');
            } else {
              showStatus('No response from the page. Please try again.', false, 'ask');
            }
          });
        } else {
          setButtonLoading(askButton, false);
          showStatus('No active tab found', false, 'ask');
        }
      });
    });
  }

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('[popup.js] Message received:', request);
    
    if (request.action === 'microphonePermissionGranted') {
      console.log('[popup.js] Microphone permission granted');
      // Permission was granted, retry speech recognition
      if (window.currentTextarea && window.currentMicButton && speechManager) {
        speechManager.start(window.currentTextarea, window.currentMicButton);
      }
    } else if (request.action === 'microphonePermissionDenied') {
      console.log('[popup.js] Microphone permission denied');
      // Permission was denied
      const tabId = window.currentTextarea && window.currentTextarea.id === 'userPrompt' ? 'modify' : 'ask';
      showStatus(`Microphone permission denied: ${request.error || 'Access not allowed'}`, false, tabId);
      
      if (window.currentMicButton) {
        window.currentMicButton.classList.add('permission-denied');
      }
    } else if (request.action === 'microphonePermissionDismissed') {
      console.log('[popup.js] Microphone permission banner dismissed');
      // User dismissed the banner
      const tabId = window.currentTextarea && window.currentTextarea.id === 'userPrompt' ? 'modify' : 'ask';
      showStatus('Microphone access is required for speech recognition', false, tabId);
    }
  });

  // Set up the permission button
  const grantMicPermissionButton = document.getElementById('grantMicPermissionButton');
  if (grantMicPermissionButton) {
    grantMicPermissionButton.addEventListener('click', function() {
      console.log('[popup.js] Grant microphone permission button clicked');
      
      try {
        // Try to open the permission page via background script
        chrome.runtime.sendMessage({ action: 'openPermissionPage' });
        
        // As a fallback, also try to open it directly
        const permissionUrl = chrome.runtime.getURL('test.html');
        chrome.tabs.create({ url: permissionUrl });
      } catch (error) {
        console.error('[popup.js] Error opening permission page:', error);
      }
      
      // Close the popup
      setTimeout(() => {
        window.close();
      }, 100);
    });
  }

  // Set up keyboard shortcut for speech recognition
  function setupKeyboardShortcuts() {
    console.log('[popup.js] Setting up keyboard shortcuts');
    
    // Track if the F key is currently pressed
    let fKeyPressed = false;
    
    // Function to determine which textarea and mic button to use based on active tab
    function getCurrentControls() {
      const activeTab = document.querySelector('.panel.active');
      if (!activeTab) return null;
      
      if (activeTab.id === 'modifyTab') {
        return {
          textarea: document.getElementById('userPrompt'),
          micButton: document.getElementById('modifyMicButton')
        };
      } else if (activeTab.id === 'askTab') {
        return {
          textarea: document.getElementById('userQuestion'),
          micButton: document.getElementById('questionMicButton')
        };
      }
      
      return null;
    }
    
    // Handle keydown event (when key is pressed)
    document.addEventListener('keydown', function(event) {
      // Check if F key is pressed and not already recording
      if (event.key.toLowerCase() === 'f' && !fKeyPressed) {
        console.log('[popup.js] F key pressed');
        fKeyPressed = true;
        
        // Get the current controls based on active tab
        const controls = getCurrentControls();
        if (!controls) return;
        
        // Set global variables for current textarea and mic button
        window.currentTextarea = controls.textarea;
        window.currentMicButton = controls.micButton;
        
        // Start recording if not already recording
        if (!controls.micButton.classList.contains('listening') && 
            !controls.micButton.classList.contains('processing')) {
          
          // Request microphone permission and start recording
          requestMicrophonePermissionViaIframe()
            .then(() => {
              console.log('[popup.js] Permission granted, starting speech recognition');
              if (speechManager) {
                speechManager.start(controls.textarea, controls.micButton);
              }
            })
            .catch(error => {
              console.error('[popup.js] Permission error:', error);
              const tabId = controls.textarea.id === 'userPrompt' ? 'modify' : 'ask';
              showStatus(`Microphone permission required: ${error.message}`, false, tabId);
            });
        }
      }
    });
    
    // Handle keyup event (when key is released)
    document.addEventListener('keyup', function(event) {
      // Check if F key is released and we were recording
      if (event.key.toLowerCase() === 'f' && fKeyPressed) {
        console.log('[popup.js] F key released');
        fKeyPressed = false;
        
        // Get the current controls
        const controls = getCurrentControls();
        if (!controls) return;
        
        // Stop recording if we were recording
        if (controls.micButton.classList.contains('listening')) {
          if (speechManager) {
            speechManager.stop();
          }
        }
      }
    });
    
    // Handle tab/window blur to stop recording if user switches away
    window.addEventListener('blur', function() {
      if (fKeyPressed) {
        console.log('[popup.js] Window lost focus, stopping recording');
        fKeyPressed = false;
        
        if (window.currentMicButton && window.currentMicButton.classList.contains('listening')) {
          if (speechManager) {
            speechManager.stop();
          }
        }
      }
    });
  }

  // Call the setup function
  setupKeyboardShortcuts();
});

// Function to handle API key management
function setupApiKeyManager() {
  const geminiKeyInput = document.getElementById('geminiApiKey');
  const saveGeminiButton = document.getElementById('saveGeminiKey');
  const testApiKeyButton = document.createElement('button');
  
  if (!geminiKeyInput || !saveGeminiButton) return;
  
  // Load existing API key from storage
  chrome.storage.local.get(['geminiApiKey'], function(result) {
    if (result.geminiApiKey && geminiKeyInput) {
      geminiKeyInput.value = result.geminiApiKey;
    }
  });
  
  // Set up save button for Gemini API key
  saveGeminiButton.addEventListener('click', function() {
    const apiKey = geminiKeyInput.value.trim();
    if (!apiKey) {
      showStatus('Please enter a Gemini API key', false, 'settings');
      return;
    }
    
    // Validate the API key format
    if (!apiKey.startsWith('AIza')) {
      showStatus('Invalid API key format. Gemini API keys should start with "AIza"', false, 'settings');
      return;
    }
    
    // Save to both local and sync storage for better compatibility
    chrome.storage.local.set({ geminiApiKey: apiKey }, function() {
      chrome.storage.sync.set({ geminiApiKey: apiKey }, function() {
        showStatus('Gemini API key saved successfully', false, 'settings');
        
        // Test the API key
        testApiKey(apiKey);
      });
    });
  });
  
  // Function to test if the API key is valid
  function testApiKey(apiKey) {
    // Try Gemini 2.0 first
    const testEndpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
    const testPayload = {
      contents: [
        {
          parts: [
            {
              text: "Hello, please respond with just the word 'valid' to confirm this API key works."
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 10
      }
    };
    
    fetch(testEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    })
    .then(response => {
      if (!response.ok) {
        return response.text().then(text => {
          throw new Error(`API test failed: ${text}`);
        });
      }
      return response.json();
    })
    .then(data => {
      showStatus('Gemini 2.0 API key verified successfully!', false, 'settings');
      // Save the working model version
      chrome.storage.local.set({ 
        geminiModel: 'gemini-1.5-pro', 
        geminiVersion: 'v1',
        workingApiKey: apiKey
      });
    })
    .catch(error => {
      console.error('Gemini 2.0 API test failed:', error);
      
      // Try Gemini 1.0 Pro
      tryGemini1Pro(apiKey);
    });
  }
  
  // Try Gemini 1.0 Pro if 2.0 fails
  function tryGemini1Pro(apiKey) {
    const endpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-1.0-pro:generateContent?key=${apiKey}`;
    const testPayload = {
      contents: [
        {
          parts: [
            {
              text: "Hello, please respond with just the word 'valid' to confirm this API key works."
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 10
      }
    };
    
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    })
    .then(response => {
      if (!response.ok) {
        return response.text().then(text => {
          throw new Error(`API test failed: ${text}`);
        });
      }
      return response.json();
    })
    .then(data => {
      showStatus('Gemini 1.0 Pro API key verified successfully!', false, 'settings');
      // Save the working model version
      chrome.storage.local.set({ 
        geminiModel: 'gemini-1.0-pro', 
        geminiVersion: 'v1',
        workingApiKey: apiKey
      });
    })
    .catch(error => {
      console.error('Gemini 1.0 Pro test failed:', error);
      
      // Try original Gemini Pro
      tryOriginalGeminiPro(apiKey);
    });
  }
  
  // Try original Gemini Pro if others fail
  function tryOriginalGeminiPro(apiKey) {
    const endpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`;
    const testPayload = {
      contents: [
        {
          parts: [
            {
              text: "Hello, please respond with just the word 'valid' to confirm this API key works."
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 10
      }
    };
    
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    })
    .then(response => {
      if (!response.ok) {
        return response.text().then(text => {
          throw new Error(`API test failed: ${text}`);
        });
      }
      return response.json();
    })
    .then(data => {
      showStatus('Gemini Pro API key verified successfully!', false, 'settings');
      // Save the working model version
      chrome.storage.local.set({ 
        geminiModel: 'gemini-pro', 
        geminiVersion: 'v1',
        workingApiKey: apiKey
      });
    })
    .catch(error => {
      console.error('Gemini Pro test failed:', error);
      
      // Try beta version as last resort
      tryBetaVersion(apiKey);
    });
  }
  
  // Try beta version as last resort
  function tryBetaVersion(apiKey) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
    const testPayload = {
      contents: [
        {
          parts: [
            {
              text: "Hello, please respond with just the word 'valid' to confirm this API key works."
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 10
      }
    };
    
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    })
    .then(response => {
      if (!response.ok) {
        return response.text().then(text => {
          throw new Error(`API test failed: ${text}`);
        });
      }
      return response.json();
    })
    .then(data => {
      showStatus('Beta API key verified successfully!', false, 'settings');
      // Save the working model version
      chrome.storage.local.set({ 
        geminiModel: 'gemini-pro', 
        geminiVersion: 'v1beta',
        workingApiKey: apiKey
      });
    })
    .catch(error => {
      console.error('All API tests failed:', error);
      showStatus('API key verification failed. Please check your API key and make sure Gemini API is enabled in your Google Cloud Console.', false, 'settings');
    });
  }

  testApiKeyButton.textContent = 'Test API Key';
  testApiKeyButton.className = 'settings-button';
  testApiKeyButton.style.marginTop = '10px';
  testApiKeyButton.addEventListener('click', function() {
    const apiKey = geminiKeyInput.value.trim();
    if (!apiKey) {
      showStatus('Please enter a Gemini API key', false, 'settings');
      return;
    }
    
    showStatus('Testing API key...', false, 'settings');
    
    // Send a message to the content script to test the API key
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs && tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'testApiKey', 
          apiKey: apiKey 
        }, function(response) {
          if (chrome.runtime.lastError) {
            console.error('Error sending message:', chrome.runtime.lastError);
            showStatus(`Error: ${chrome.runtime.lastError.message}`, false, 'settings');
            return;
          }
          
          if (response && response.success) {
            showStatus(`API key works with ${response.model} (${response.version})!`, false, 'settings');
          } else if (response && response.error) {
            showStatus(`API key test failed: ${response.error}`, false, 'settings');
          } else {
            showStatus('No response from the page. Please try again.', false, 'settings');
          }
        });
      } else {
        showStatus('No active tab found', false, 'settings');
      }
    });
  });

  // Add the button to the settings section
  const apiKeySection = document.querySelector('.api-key-section');
  if (apiKeySection) {
    apiKeySection.appendChild(testApiKeyButton);
  }
} 