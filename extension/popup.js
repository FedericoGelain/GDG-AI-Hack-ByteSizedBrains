document.addEventListener('DOMContentLoaded', function() {
  const userPromptElement = document.getElementById('userPrompt');
  const modifyButton = document.getElementById('modifyButton');
  const modificationHistoryElement = document.getElementById('modificationHistory');
  const debugOutput = document.getElementById('debugOutput');
  
  // Add debug logging function
  function logDebug(message) {
    const logEntry = document.createElement('div');
    logEntry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
    debugOutput.prepend(logEntry);
    console.log(message);
  }
  
  logDebug('Popup loaded');
  
  // Load modification history
  loadModificationHistory();
  
  // Handle modify button click
  modifyButton.addEventListener('click', async function() {
    const prompt = userPromptElement.value.trim();
    if (!prompt) {
      alert('Please enter a prompt describing how to modify the page.');
      return;
    }
    
    // Load API key from .env file
    const apiKey = await loadApiKey();
    if (!apiKey) {
      logDebug('API key not found in .env file');
      alert('API key not found. Please check your .env file.');
      return;
    }
    
    // Show loading state
    modifyButton.textContent = 'Modifying...';
    modifyButton.disabled = true;
    
    // First check if we can access the tab
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (!tabs || tabs.length === 0) {
        logDebug('No active tab found');
        alert('Error: Cannot access the current tab');
        modifyButton.textContent = 'Modify Page';
        modifyButton.disabled = false;
        return;
      }
      
      const activeTab = tabs[0];
      logDebug(`Active tab: ${activeTab.url}`);
      
      // First inject the content script
      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['content.js']
      }).then(() => {
        // Wait a moment for the content script to initialize
        setTimeout(() => {
          // Now send the message to the content script
          logDebug('Sending message to content script');
          chrome.tabs.sendMessage(
            activeTab.id,
            { action: 'modifyPage', prompt: prompt, apiKey: apiKey },
            function(response) {
              // Reset button state
              modifyButton.textContent = 'Modify Page';
              modifyButton.disabled = false;
              
              if (chrome.runtime.lastError) {
                logDebug(`Error: ${chrome.runtime.lastError.message}`);
                alert(`Error: ${chrome.runtime.lastError.message}. Try reloading the page.`);
                return;
              }
              
              if (response && response.success) {
                // Save to history
                logDebug('Modification successful');
                saveToHistory(prompt);
                userPromptElement.value = '';
              } else {
                logDebug(`Error: ${response ? response.error : 'Unknown error'}`);
                alert('Error: ' + (response ? response.error : 'Unknown error'));
              }
            }
          );
        }, 500); // Wait 500ms for the content script to initialize
      }).catch(err => {
        logDebug(`Script injection error: ${err.message}`);
        alert(`Cannot access this page. The extension may not have permission to run on this page.`);
        modifyButton.textContent = 'Modify Page';
        modifyButton.disabled = false;
      });
    });
  });
  
  function loadModificationHistory() {
    chrome.storage.local.get('modificationHistory', function(data) {
      const history = data.modificationHistory || [];
      modificationHistoryElement.innerHTML = '';
      
      history.slice(0, 5).forEach(function(item) {
        const li = document.createElement('li');
        li.textContent = item.prompt;
        li.title = new Date(item.timestamp).toLocaleString();
        li.addEventListener('click', function() {
          userPromptElement.value = item.prompt;
        });
        modificationHistoryElement.appendChild(li);
      });
      
      logDebug(`Loaded ${history.length} history items`);
    });
  }
  
  function saveToHistory(prompt) {
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
  
  // Update version info
  const versionInfo = document.querySelector('.version-info');
  if (versionInfo) {
    versionInfo.textContent = `Version: 1.0.8 (Last updated: ${new Date().toLocaleString()})`;
  }
}); 