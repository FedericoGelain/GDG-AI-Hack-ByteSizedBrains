window.onerror = function(message, source, lineno, colno, error) {
  console.error('Error:', message, 'at', source, 'line', lineno, 'column', colno);
  alert('Error: ' + message);
  return true;
};

document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup loaded');
  
  // UI Elements
  const userPromptElement = document.getElementById('userPrompt');
  const userQuestionElement = document.getElementById('userQuestion');
  const modifyButton = document.getElementById('modifyButton');
  const askButton = document.getElementById('askButton');
  const modificationHistoryElement = document.getElementById('modificationHistory');
  const questionHistoryElement = document.getElementById('questionHistory');
  const answerTextElement = document.getElementById('answerText');
  const debugOutput = document.getElementById('debugOutput');
  const debugToggle = document.getElementById('debugToggle');
  const debugSection = document.getElementById('debugSection');
  
  // Tab Elements
  const modifyTab = document.getElementById('modifyTab');
  const questionTab = document.getElementById('questionTab');
  const historyTab = document.getElementById('historyTab');
  const modifyPanel = document.getElementById('modifyPanel');
  const questionPanel = document.getElementById('questionPanel');
  const historyPanel = document.getElementById('historyPanel');
  
  // Check if all required elements are found
  if (!userPromptElement) console.error('userPromptElement not found');
  if (!userQuestionElement) console.error('userQuestionElement not found');
  if (!modifyButton) console.error('modifyButton not found');
  if (!askButton) console.error('askButton not found');
  if (!modificationHistoryElement) console.error('modificationHistoryElement not found');
  if (!questionHistoryElement) console.error('questionHistoryElement not found');
  if (!answerTextElement) console.error('answerTextElement not found');
  if (!debugOutput) console.error('debugOutput not found');
  if (!debugToggle) console.error('debugToggle not found');
  if (!debugSection) console.error('debugSection not found');
  if (!modifyTab) console.error('modifyTab not found');
  if (!questionTab) console.error('questionTab not found');
  if (!historyTab) console.error('historyTab not found');
  if (!modifyPanel) console.error('modifyPanel not found');
  if (!questionPanel) console.error('questionPanel not found');
  if (!historyPanel) console.error('historyPanel not found');
  
  // Add debug logging function
  function logDebug(message) {
    const logEntry = document.createElement('div');
    logEntry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
    debugOutput.prepend(logEntry);
    console.log(message);
  }
  
  // Tab switching
  function switchTab(tab) {
    // Remove active class from all tabs and panels
    [modifyTab, questionTab, historyTab].forEach(t => t.classList.remove('active'));
    [modifyPanel, questionPanel, historyPanel].forEach(p => p.classList.remove('active'));
    
    // Add active class to selected tab and panel
    if (tab === 'modify') {
      modifyTab.classList.add('active');
      modifyPanel.classList.add('active');
    } else if (tab === 'question') {
      questionTab.classList.add('active');
      questionPanel.classList.add('active');
    } else if (tab === 'history') {
      historyTab.classList.add('active');
      historyPanel.classList.add('active');
    }
  }
  
  // Set up tab event listeners
  modifyTab.onclick = function() {
    logDebug('Modify tab clicked');
    switchTab('modify');
  };
  
  questionTab.onclick = function() {
    logDebug('Question tab clicked');
    switchTab('question');
  };
  
  historyTab.onclick = function() {
    logDebug('History tab clicked');
    switchTab('history');
  };
  
  // Toggle debug section
  debugToggle.onclick = function() {
    if (debugSection.style.display === 'none') {
      debugSection.style.display = 'block';
      debugToggle.textContent = 'Hide Debug';
    } else {
      debugSection.style.display = 'none';
      debugToggle.textContent = 'Show Debug';
    }
  };
  
  // Load histories
  loadModificationHistory();
  loadQuestionHistory();
  
  // Handle modify button click
  modifyButton.onclick = function() {
    logDebug('Modify button clicked');
    
    const prompt = userPromptElement.value.trim();
    if (!prompt) {
      alert('Please enter a prompt describing how to modify the page.');
      return;
    }
    
    // Show loading state
    modifyButton.textContent = 'Modifying...';
    modifyButton.disabled = true;
    
    // Get the current tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || tabs.length === 0) {
        alert('Cannot access the current tab');
        modifyButton.textContent = 'Modify Page';
        modifyButton.disabled = false;
        return;
      }
      
      const tab = tabs[0];
      
      // Check if we can access this tab
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
        alert('Cannot modify this page. The extension does not have permission to run on this page.');
        modifyButton.textContent = 'Modify Page';
        modifyButton.disabled = false;
        return;
      }
      
      // Execute a script to check if we can access the page
      chrome.scripting.executeScript({
        target: {tabId: tab.id},
        func: () => {
          return {
            url: window.location.href,
            title: document.title
          };
        }
      }).then(results => {
        // Now inject our content script
        chrome.scripting.executeScript({
          target: {tabId: tab.id},
          files: ['content.js']
        }).then(() => {
          // Wait a moment for the script to initialize
          setTimeout(() => {
            // Get API key and send the message
            loadApiKeyForRequest().then(apiKey => {
              logDebug(`Using API key (first 4 chars): ${apiKey ? apiKey.substring(0, 4) + '...' : 'none'}`);
              
              chrome.tabs.sendMessage(
                tab.id,
                { action: 'modifyPage', prompt: prompt, apiKey: apiKey },
                function(response) {
                  modifyButton.textContent = 'Modify Page';
                  modifyButton.disabled = false;
                  
                  if (chrome.runtime.lastError) {
                    console.error('Error:', chrome.runtime.lastError.message);
                    alert('Error: ' + chrome.runtime.lastError.message);
                    return;
                  }
                  
                  if (response && response.success) {
                    saveToModificationHistory(prompt);
                    userPromptElement.value = '';
                  } else {
                    alert('Error: ' + (response ? response.error : 'Unknown error'));
                  }
                }
              );
            });
          }, 500);
        }).catch(err => {
          console.error('Script injection error:', err);
          alert('Cannot access this page. The extension may not have permission to run on this page.');
          modifyButton.textContent = 'Modify Page';
          modifyButton.disabled = false;
        });
      }).catch(err => {
        console.error('Initial script execution error:', err);
        alert('Cannot access this page. The extension may not have permission to run on this page.');
        modifyButton.textContent = 'Modify Page';
        modifyButton.disabled = false;
      });
    });
  };
  
  // Handle ask button click
  askButton.onclick = function() {
    logDebug('Ask button clicked');
    
    const question = userQuestionElement.value.trim();
    if (!question) {
      alert('Please enter a question about the page.');
      return;
    }
    
    // Show loading state
    askButton.textContent = 'Asking...';
    askButton.disabled = true;
    answerTextElement.textContent = 'Loading answer...';
    
    // Get the current tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || tabs.length === 0) {
        alert('Cannot access the current tab');
        askButton.textContent = 'Ask Question';
        askButton.disabled = false;
        answerTextElement.textContent = '';
        return;
      }
      
      const tab = tabs[0];
      
      // Check if we can access this tab
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
        alert('Cannot ask questions about this page. The extension does not have permission to run on this page.');
        askButton.textContent = 'Ask Question';
        askButton.disabled = false;
        answerTextElement.textContent = '';
        return;
      }
      
      // Execute a script to check if we can access the page
      chrome.scripting.executeScript({
        target: {tabId: tab.id},
        func: () => {
          return {
            url: window.location.href,
            title: document.title
          };
        }
      }).then(results => {
        // Now inject our content script
        chrome.scripting.executeScript({
          target: {tabId: tab.id},
          files: ['content.js']
        }).then(() => {
          // Wait a moment for the script to initialize
          setTimeout(() => {
            // Get API key and send the message
            loadApiKeyForRequest().then(apiKey => {
              logDebug(`Using API key (first 4 chars): ${apiKey ? apiKey.substring(0, 4) + '...' : 'none'}`);
              
              chrome.tabs.sendMessage(
                tab.id,
                { action: 'askQuestion', question: question, apiKey: apiKey },
                function(response) {
                  askButton.textContent = 'Ask Question';
                  askButton.disabled = false;
                  
                  if (chrome.runtime.lastError) {
                    console.error('Error:', chrome.runtime.lastError.message);
                    answerTextElement.textContent = 'Error: ' + chrome.runtime.lastError.message;
                    return;
                  }
                  
                  if (response && response.success) {
                    answerTextElement.textContent = response.answer;
                    saveToQuestionHistory(question, response.answer);
                  } else {
                    answerTextElement.textContent = 'Error: ' + (response ? response.error : 'Unknown error');
                  }
                }
              );
            });
          }, 500);
        }).catch(err => {
          console.error('Script injection error:', err);
          answerTextElement.textContent = 'Cannot access this page. The extension may not have permission to run on this page.';
          askButton.textContent = 'Ask Question';
          askButton.disabled = false;
        });
      }).catch(err => {
        console.error('Initial script execution error:', err);
        answerTextElement.textContent = 'Cannot access this page. The extension may not have permission to run on this page.';
        askButton.textContent = 'Ask Question';
        askButton.disabled = false;
      });
    });
  };
  
  function loadModificationHistory() {
    chrome.storage.local.get('modificationHistory', function(data) {
      const history = data.modificationHistory || [];
      modificationHistoryElement.innerHTML = '';
      
      if (history.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.textContent = 'No modification history yet';
        emptyMessage.className = 'empty-message';
        modificationHistoryElement.appendChild(emptyMessage);
        return;
      }
      
      history.slice(0, 5).forEach(function(item) {
        const li = document.createElement('li');
        li.textContent = item.prompt;
        li.title = new Date(item.timestamp).toLocaleString();
        li.addEventListener('click', function() {
          userPromptElement.value = item.prompt;
          switchTab('modify');
        });
        modificationHistoryElement.appendChild(li);
      });
      
      logDebug(`Loaded ${history.length} modification history items`);
    });
  }
  
  function loadQuestionHistory() {
    chrome.storage.local.get('questionHistory', function(data) {
      const history = data.questionHistory || [];
      questionHistoryElement.innerHTML = '';
      
      if (history.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.textContent = 'No question history yet';
        emptyMessage.className = 'empty-message';
        questionHistoryElement.appendChild(emptyMessage);
        return;
      }
      
      history.slice(0, 5).forEach(function(item) {
        const li = document.createElement('li');
        li.textContent = item.question;
        li.title = `${item.answer}\n\n${new Date(item.timestamp).toLocaleString()}`;
        li.addEventListener('click', function() {
          userQuestionElement.value = item.question;
          answerTextElement.textContent = item.answer;
          switchTab('question');
        });
        questionHistoryElement.appendChild(li);
      });
      
      logDebug(`Loaded ${history.length} question history items`);
    });
  }
  
  function saveToModificationHistory(prompt) {
    chrome.storage.local.get('modificationHistory', function(data) {
      const history = data.modificationHistory || [];
      history.unshift({
        prompt: prompt,
        timestamp: Date.now()
      });
      
      // Keep only the last 10 items
      const updatedHistory = history.slice(0, 10);
      chrome.storage.local.set({ modificationHistory: updatedHistory }, function() {
        loadModificationHistory();
      });
    });
  }
  
  function saveToQuestionHistory(question, answer) {
    chrome.storage.local.get('questionHistory', function(data) {
      const history = data.questionHistory || [];
      history.unshift({
        question: question,
        answer: answer,
        timestamp: Date.now()
      });
      
      // Keep only the last 10 items
      const updatedHistory = history.slice(0, 10);
      chrome.storage.local.set({ questionHistory: updatedHistory }, function() {
        loadQuestionHistory();
      });
    });
  }
  
  // Update version info
  const versionInfo = document.querySelector('.version-info');
  if (versionInfo) {
    versionInfo.textContent = `Version: 1.0.9`;
  }

  console.log('Popup script loaded');

  // Add this to your DOMContentLoaded event handler
  const reloadButton = document.getElementById('reloadButton');
  if (reloadButton) {
    reloadButton.addEventListener('click', function() {
      chrome.runtime.reload();
    });
  }

  // Add this to your DOMContentLoaded event handler
  const loadEnvButton = document.getElementById('loadEnvButton');
  if (loadEnvButton) {
    loadEnvButton.onclick = async function() {
      logDebug('Loading API key from .env file...');
      
      try {
        // Try to fetch the .env file directly
        const response = await fetch(chrome.runtime.getURL('.env'));
        if (!response.ok) {
          logDebug(`Failed to load .env file: ${response.status} ${response.statusText}`);
          alert(`Failed to load .env file: ${response.status} ${response.statusText}`);
          return;
        }
        
        const text = await response.text();
        logDebug(`.env file loaded, content length: ${text.length}`);
        
        // Parse the .env file
        const lines = text.split('\n');
        let apiKey = null;
        
        for (const line of lines) {
          if (line.trim().startsWith('GEMINI_API_KEY=')) {
            apiKey = line.trim().substring('GEMINI_API_KEY='.length);
            break;
          }
        }
        
        if (apiKey) {
          // Save to storage
          chrome.storage.sync.set({apiKey: apiKey}, function() {
            const maskedKey = apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
            logDebug(`API key loaded and saved: ${maskedKey}`);
            alert(`API key loaded successfully: ${maskedKey}`);
          });
        } else {
          logDebug('API key not found in .env file');
          alert('API key not found in .env file. Make sure it starts with GEMINI_API_KEY=');
        }
      } catch (error) {
        logDebug(`Error loading .env file: ${error.message}`);
        alert(`Error loading .env file: ${error.message}`);
      }
    };
  }

  // Add this helper function at the end of your file:
  async function loadApiKeyForRequest() {
    try {
      // First try to get from storage
      const result = await new Promise(resolve => {
        chrome.storage.sync.get('apiKey', resolve);
      });
      
      if (result.apiKey) {
        logDebug('Using API key from storage');
        return result.apiKey;
      }
      
      // If not in storage, try to load from .env
      logDebug('No API key in storage, trying to load from .env');
      const envKey = await loadApiKey();
      if (envKey) {
        // Save to storage for future use
        chrome.storage.sync.set({apiKey: envKey});
        logDebug('API key loaded from .env and saved to storage');
        return envKey;
      }
      
      logDebug('No API key found');
      return '';
    } catch (error) {
      logDebug(`Error loading API key: ${error.message}`);
      return '';
    }
  }
}); 