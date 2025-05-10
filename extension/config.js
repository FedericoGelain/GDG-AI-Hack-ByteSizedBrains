// Load API key from .env file
async function loadApiKey() {
  try {
    const response = await fetch(chrome.runtime.getURL('.env'));
    const text = await response.text();
    
    // Parse the .env file
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('GEMINI_API_KEY=')) {
        const apiKey = line.trim().substring('GEMINI_API_KEY='.length);
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

// Export the function
window.loadApiKey = loadApiKey; 