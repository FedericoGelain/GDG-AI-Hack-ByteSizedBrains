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

// Load environment variables from .env file
async function loadEnvFile() {
  try {
    const response = await fetch(chrome.runtime.getURL('.env'));
    const text = await response.text();
    
    // Parse the .env file
    const env = {};
    text.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (key && value) {
          env[key] = value;
        }
      }
    });
    
    return env;
  } catch (error) {
    console.error('Error loading .env file:', error);
    return {};
  }
}

// Load API key from .env file
async function loadApiKey() {
  const env = await loadEnvFile();
  return env.GEMINI_API_KEY || '';
}

// Load OpenAI API key from .env file
async function loadOpenAIApiKey() {
  const env = await loadEnvFile();
  return env.OPENAI_API_KEY || '';
}

// Export the functions
window.getApiKey = getApiKey;
window.setApiKey = setApiKey;
window.loadApiKey = loadApiKey;
window.loadOpenAIApiKey = loadOpenAIApiKey;

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