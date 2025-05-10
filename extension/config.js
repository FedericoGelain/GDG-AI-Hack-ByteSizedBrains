// Configuration for AI Web Modifier extension
const config = {
  // Default API key (empty)
  API_KEY: "", 
  
  // Version information
  VERSION: "1.0.9"
};

// Get the current API key (either from storage or config)
async function getApiKey() {
  try {
    // Try to get the API key from Chrome storage
    const result = await chrome.storage.sync.get('apiKey');
    if (result.apiKey) {
      console.log('Using API key from storage');
      return result.apiKey;
    }
    
    // If not in storage, try to load from .env
    const envKey = await loadApiKey();
    if (envKey) {
      // Save to storage for future use
      await chrome.storage.sync.set({apiKey: envKey});
      return envKey;
    }
    
    // Fall back to the hardcoded key in config
    console.log('Using default API key from config');
    return config.API_KEY;
  } catch (error) {
    console.error('Error getting API key:', error);
    return config.API_KEY;
  }
}

// Set a new API key
async function setApiKey(newKey) {
  try {
    // Update in storage
    await chrome.storage.sync.set({apiKey: newKey});
    // Update in memory
    config.API_KEY = newKey;
    console.log('API key updated successfully');
    return true;
  } catch (error) {
    console.error('Error setting API key:', error);
    return false;
  }
}

// Load API key from .env file
async function loadApiKey() {
  try {
    console.log('Attempting to load API key from .env file');
    
    // Try to fetch the .env file
    const response = await fetch(chrome.runtime.getURL('.env'));
    console.log('.env fetch response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`Failed to load .env file: ${response.status} ${response.statusText}`);
    }
    
    const text = await response.text();
    console.log('.env file content length:', text.length);
    
    // Parse the .env file
    const lines = text.split('\n');
    console.log('Number of lines in .env:', lines.length);
    
    for (const line of lines) {
      console.log('Processing line:', line);
      if (line.trim().startsWith('GEMINI_API_KEY=')) {
        const apiKey = line.trim().substring('GEMINI_API_KEY='.length);
        console.log('Found API key in .env file (first 4 chars):', apiKey.substring(0, 4) + '...');
        
        // Update the config object with the loaded API key
        config.API_KEY = apiKey;
        console.log('API key loaded successfully from .env file');
        return apiKey;
      }
    }
    
    console.error('API key not found in .env file');
    return null;
  } catch (error) {
    console.error('Error loading .env file:', error);
    return null;
  }
}

// Export the functions
window.getApiKey = getApiKey;
window.setApiKey = setApiKey;
window.loadApiKey = loadApiKey;

// Simple function to get the API key from storage
window.getApiKey = function() {
  return new Promise((resolve) => {
    chrome.storage.sync.get('apiKey', function(result) {
      resolve(result.apiKey || '');
    });
  });
};

// Initialize the API key input field if it exists
document.addEventListener('DOMContentLoaded', function() {
  const apiKeyInput = document.getElementById('apiKey');
  if (apiKeyInput) {
    // Load the saved API key
    chrome.storage.sync.get('apiKey', function(result) {
      if (result.apiKey) {
        apiKeyInput.value = result.apiKey;
      }
    });
    
    // Save the API key when it changes
    apiKeyInput.addEventListener('change', function() {
      const apiKey = apiKeyInput.value.trim();
      chrome.storage.sync.set({ apiKey: apiKey }, function() {
        console.log('API key saved');
      });
    });
  }
}); 