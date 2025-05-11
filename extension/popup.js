window.onerror = function(message, source, lineno, colno, error) {
  console.error('Error:', message, 'at', source, 'line', lineno, 'column', colno);
  alert('Error: ' + message);
  return true;
};

document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup loaded');
  
  // Set up tabs
  setupTabs();
  
  // Load prompt history
  loadPromptHistory();
  
  // Define showStatus function at the top
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
    if (showSubmitButton && currentTextarea) {
      const submitButton = document.createElement('button');
      submitButton.textContent = 'Submit';
      submitButton.className = 'small-button submit-button';
      submitButton.addEventListener('click', () => {
        // Click the appropriate action button
        if (currentTextarea.id === 'userPrompt') {
          document.getElementById('modifyButton').click();
        } else if (currentTextarea.id === 'userQuestion') {
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
  
  // Track current mic button and textarea
  let currentMicButton = null;
  let currentTextarea = null;
  
  // Function to request microphone permission using the permission.html iframe
  function requestMicrophonePermissionViaIframe() {
    console.log('[popup.js] Requesting microphone permission via iframe');
    
    return new Promise((resolve, reject) => {
      // Create an iframe to load the permission.html page
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = chrome.runtime.getURL('permission.html');
      
      // Set up message listener for iframe communication
      const messageListener = function(event) {
        console.log('[popup.js] Received message from iframe:', event.data);
        
        if (event.data.type === 'PERMISSION_GRANTED') {
          console.log('[popup.js] Permission granted via iframe');
          window.removeEventListener('message', messageListener);
          document.body.removeChild(iframe);
          resolve();
        } else if (event.data.type === 'PERMISSION_DENIED') {
          console.log('[popup.js] Permission denied via iframe');
          window.removeEventListener('message', messageListener);
          document.body.removeChild(iframe);
          reject(new Error(event.data.error || 'Permission denied'));
        }
      };
      
      window.addEventListener('message', messageListener);
      
      // Add iframe to the document
      document.body.appendChild(iframe);
      
      // Set a timeout in case we don't get a response
      setTimeout(() => {
        window.removeEventListener('message', messageListener);
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        reject(new Error('Permission request timed out'));
      }, 30000); // 30 second timeout
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
      currentTextarea = textarea;
      currentMicButton = modifyMicButton;
      
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
          if (currentMicButton) {
            currentMicButton.classList.add('permission-denied');
          }
        });
    });
    
    questionMicButton.addEventListener('click', function() {
      console.log('[popup.js] Question mic button clicked');
      const textarea = document.getElementById('userQuestion');
      currentTextarea = textarea;
      currentMicButton = questionMicButton;
      
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
          if (currentMicButton) {
            currentMicButton.classList.add('permission-denied');
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
      
      // First get the API key from background script
      chrome.runtime.sendMessage({action: 'getApiKey'}, function(apiKey) {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
          if (tabs && tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { 
              action: 'modifyPage', 
              prompt: prompt,
              apiKey: apiKey // Pass the API key from background
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
    });
  }
  
  if (askButton) {
    askButton.addEventListener('click', function() {
      const question = document.getElementById('userQuestion').value.trim();
      if (!question) {
        showStatus('Please enter a question about the page.', false, 'ask');
        return;
      }
      
      // Set button to loading state
      setButtonLoading(askButton, true);
      
      // First get the API key from background script
      chrome.runtime.sendMessage({action: 'getApiKey'}, function(apiKey) {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
          if (tabs && tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { 
              action: 'askQuestion', 
              question: question,
              apiKey: apiKey // Pass the API key from background
            }, function(response) {
              // Reset loading state
              setButtonLoading(askButton, false);
              
              if (chrome.runtime.lastError) {
                showStatus(`Error: ${chrome.runtime.lastError.message}`, false, 'ask');
                return;
              }
              
              if (response && response.success) {
                showStatus('Processing your question...', false, 'ask');
                
                // If there's an answer in the response, display it
                if (response.answer) {
                  const answerContainer = document.querySelector('.answer-container');
                  const answerText = document.querySelector('.answer-text');
                  
                  if (answerContainer && answerText) {
                    answerText.textContent = response.answer;
                    answerContainer.style.display = 'block';
                  }
                }
              } else if (response && response.error) {
                showStatus(`Error: ${response.error}`, false, 'ask');
              }
            });
          } else {
            setButtonLoading(askButton, false);
            showStatus('No active tab found', false, 'ask');
          }
        });
      });
    });
  }

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('[popup.js] Message received:', request);
    
    if (request.action === 'microphonePermissionGranted') {
      console.log('[popup.js] Microphone permission granted');
      // Permission was granted, retry speech recognition
      if (currentTextarea && currentMicButton && speechManager) {
        speechManager.start(currentTextarea, currentMicButton);
      }
    } else if (request.action === 'microphonePermissionDenied') {
      console.log('[popup.js] Microphone permission denied');
      // Permission was denied
      const tabId = currentTextarea && currentTextarea.id === 'userPrompt' ? 'modify' : 'ask';
      showStatus(`Microphone permission denied: ${request.error || 'Access not allowed'}`, false, tabId);
      
      if (currentMicButton) {
        currentMicButton.classList.add('permission-denied');
      }
    } else if (request.action === 'microphonePermissionDismissed') {
      console.log('[popup.js] Microphone permission banner dismissed');
      // User dismissed the banner
      const tabId = currentTextarea && currentTextarea.id === 'userPrompt' ? 'modify' : 'ask';
      showStatus('Microphone access is required for speech recognition', false, tabId);
    }
  });

  const grantMicPermissionButton = document.getElementById('grantMicPermissionButton');
  if (grantMicPermissionButton) {
    grantMicPermissionButton.addEventListener('click', function() {
      chrome.tabs.create({ url: chrome.runtime.getURL('test.html') });
    });
  }
}); 