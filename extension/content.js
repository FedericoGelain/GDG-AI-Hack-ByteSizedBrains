// Content script for AI Web Modifier
console.log('[content.js] SCRIPT LOADED AND RUNNING on:', window.location.href);
console.log('Content script loaded - version 1.0.9');

// Add speech recognition functionality to content.js
let speechRecognitionActive = false;
let mediaRecorder = null;
let audioChunks = [];

// Function to start speech recognition
function startSpeechRecognition(callback) {
  if (speechRecognitionActive) {
    stopSpeechRecognition();
    return;
  }
  
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      speechRecognitionActive = true;
      
      // Create media recorder
      mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      // Set up data handler
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };
      
      // Set up stop handler
      mediaRecorder.onstop = async () => {
        // Process audio only if we're still active (not manually stopped)
        if (speechRecognitionActive) {
          try {
            const transcript = await processAudioAndGetTranscript();
            if (callback && typeof callback === 'function') {
              callback(transcript);
            }
          } catch (error) {
            console.error('Speech recognition error:', error);
            if (callback && typeof callback === 'function') {
              callback(null, error);
            }
          }
        }
        
        // Clean up
        stream.getTracks().forEach(track => track.stop());
        speechRecognitionActive = false;
      };
      
      // Start recording
      audioChunks = [];
      mediaRecorder.start(1000); // Collect data every second
      
      return true;
    })
    .catch(error => {
      console.error('Error accessing microphone:', error);
      if (callback && typeof callback === 'function') {
        callback(null, error);
      }
      return false;
    });
}

// Function to stop speech recognition
function stopSpeechRecognition() {
  if (!speechRecognitionActive || !mediaRecorder) {
    return;
  }
  
  speechRecognitionActive = false;
  
  if (mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

// Function to process audio and get transcript
async function processAudioAndGetTranscript() {
  return new Promise((resolve, reject) => {
    try {
      // Create audio blob
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      
      if (audioBlob.size === 0) {
        reject(new Error('No audio recorded'));
        return;
      }
      
      // Prepare form data for upload
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      // Send to backend
      fetch('http://localhost:8000/transcribe', {
        method: 'POST',
        body: formData
      })
      .then(response => {
        if (!response.ok) {
          return response.text().then(text => {
            throw new Error(`HTTP error! status: ${response.status}, message: ${text}`);
          });
        }
        return response.json();
      })
      .then(result => {
        if (result.error) {
          reject(new Error(result.error));
        } else if (result.transcript) {
          resolve(result.transcript);
        } else {
          reject(new Error('No transcript returned from server'));
        }
      })
      .catch(error => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('[content.js] Message received:', request);
  
  // Handle different actions
  if (request.action === 'modifyPage') {
    console.log('Received modify page request with prompt:', request.prompt);
    modifyPageWithAI(request.prompt, request.apiKey)
      .then(result => {
        console.log('Page modification successful');
        // Apply the HTML to the current page
        applyHtmlToCurrentPage(result);
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('Page modification failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  } else if (request.action === 'askQuestion') {
    console.log('Received ask question request:', request.question);
    askQuestionAboutPage(request.question, request.apiKey)
      .then(answer => {
        console.log('Question answered successfully');
        sendResponse({ success: true, answer: answer });
      })
      .catch(error => {
        console.error('Question answering failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  } else if (request.action === 'requestMicrophonePermission') {
    console.log('[content.js] Showing microphone permission banner');
    
    // Show the permission banner and handle the promise
    showMicrophonePermissionBanner()
      .then(() => {
        console.log('[content.js] Permission banner accepted');
        sendResponse({ success: true });
      })
      .catch(error => {
        console.log('[content.js] Permission banner rejected:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Keep the message channel open for the async response
  } else if (request.action === 'startSpeechRecognition') {
    startSpeechRecognition((transcript, error) => {
      if (error) {
        sendResponse({ success: false, error: error.message });
      } else {
        sendResponse({ success: true, transcript });
      }
    });
    return true; // Indicates we'll respond asynchronously
  } else if (request.action === 'stopSpeechRecognition') {
    stopSpeechRecognition();
    sendResponse({ success: true });
  }
  
  console.log('[content.js] Received message from popup:', request);
  
  // Respond to ping to confirm content script is loaded
  if (request.action === 'ping') {
    console.log('Received ping, sending response');
    sendResponse({status: 'ready'});
    return true; // Keep the message channel open for async response
  }

  if (request.action === 'injectMicButton') {
    injectMicButton();
  }
  
  // Return true if we're handling the response asynchronously
  return true;
});

// Function to apply the generated HTML to the current page
function applyHtmlToCurrentPage(htmlContent) {
  try {
    console.log('Applying HTML to current page');
    
    // Parse the HTML content
    const parser = new DOMParser();
    const newDoc = parser.parseFromString(htmlContent, 'text/html');
    
    // Check if we have a valid HTML document
    if (!newDoc.body) {
      console.error('Generated HTML does not have a body element');
      return;
    }
    
    // Replace the current page's content with the new content
    document.open();
    document.write(htmlContent);
    document.close();
    
    console.log('HTML applied successfully');
  } catch (error) {
    console.error('Error applying HTML to page:', error);
  }
}

// Function to modify page with AI
async function modifyPageWithAI(prompt, apiKey) {
  try {
    console.log('Starting page modification with prompt:', prompt);
    
    // If no API key was provided, try to get it from config
    if (!apiKey) {
      try {
        apiKey = await chrome.runtime.sendMessage({action: 'getApiKey'});
        console.log('Got API key from background script');
      } catch (error) {
        console.error('Failed to get API key:', error);
        throw new Error('No API key provided. Please enter an API key in the extension popup.');
      }
    }
    
    // Get the current page URL and HTML content
    const pageUrl = window.location.href;
    const pageTitle = document.title;
    const pageContent = document.documentElement.outerHTML;
    
    console.log('Current page URL:', pageUrl);
    
    // Use Gemini API with the actual page content
    console.log('Using Gemini API...');
    return await modifyPageWithGeminiAPI(prompt, apiKey, pageUrl, pageTitle, pageContent);
  } catch (error) {
    console.error('Error modifying page:', error);
    throw error;
  }
}

// Function to modify page with Gemini API
async function modifyPageWithGeminiAPI(prompt, apiKey, pageUrl, pageTitle, pageContent) {
  try {
    console.log('Starting Gemini API request...');
    
    // Validate API key format
    if (!apiKey || !apiKey.startsWith('AIza')) {
      console.error('Invalid API key format. API keys should start with "AIza"');
      throw new Error('Invalid API key format. Please check your API key.' + apiKey + ";");
    }
    
    // Log a masked version of the API key for debugging (showing only first 8 chars)
    const maskedKey = apiKey.substring(0, 8) + '...';
    console.log(`Using API key: ${maskedKey}`);
    
    // Prepare the prompt for the AI
    const systemPrompt = "You are a helpful assistant that modifies HTML content."
      + " You will be given the HTML content of a web page and a request to modify it."
      + " Your task is to modify the HTML according to the user's request and return the complete modified HTML."
      + " Pay special attention to styling requests - if the user wants to change colors, layouts, fonts, or any visual aspects, make those changes."
      + " Always include a comprehensive <style> section in the <head> of your response to implement all visual changes."
      + " Make sure the HTML is valid, complete, and creates a user-friendly page."
      + " Ensure the page is accessible for older people and people with disabilities."
      + " Use modern CSS techniques like flexbox or grid when appropriate for layout."
      + " Focus on clean, readable design with good contrast and appropriate font sizes.";
    
    // Create a simplified version of the HTML to reduce token count
    const simplifiedHtml = simplifyHtml(pageContent);
    
    const userPrompt = `
      I am on a web page with the URL: ${pageUrl}
      Title: ${pageTitle}
      
      User request: "${prompt}"
      
      Here is the HTML content of the page:
      ${simplifiedHtml}
      
      Please modify this HTML according to my request, and provide the complete modified HTML.
      If my request involves changing the style, colors, layout, or any visual aspects, make sure to implement those changes using CSS.
      Include all necessary CSS in a <style> tag in the <head> section.
      Return only valid HTML without any explanations or markdown.
    `;
    
    console.log('Calling Gemini API...');
    
    // Prepare the payload according to the Gemini API format
    const payload = {
      contents: [
        {
          parts: [
            { text: systemPrompt },
            { text: userPrompt }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.4
      }
    };
    
    // Use Gemini 1.5 Flash for better performance
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    console.log('Using API URL:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('API response error:', errorData);
      
      // Better error handling for API key issues
      if (errorData.error && errorData.error.status === 'INVALID_ARGUMENT') {
        throw new Error('Invalid API key. Please check your API key and make sure it is enabled for Gemini API.');
      }
      
      if (errorData.error && errorData.error.status === 'PERMISSION_DENIED') {
        throw new Error('Permission denied. Your API key may not have access to Gemini API or has restrictions.');
      }
      
      // If the model is not found, try an alternative model
      if (errorData.error && errorData.error.message && 
          errorData.error.message.includes('not found for API version')) {
        console.log('Trying alternative model...');
        return tryAlternativeModel(prompt, apiKey, payload, pageUrl, pageTitle, pageContent);
      }
      
      throw new Error(errorData.error?.message || 'API request failed');
    }
    
    const data = await response.json();
    console.log('API response received:', data);
    
    // Extract the HTML content from the response
    let htmlContent = '';
    if (data.candidates && 
        data.candidates[0] && 
        data.candidates[0].content && 
        data.candidates[0].content.parts && 
        data.candidates[0].content.parts[0]) {
      htmlContent = data.candidates[0].content.parts[0].text;
      console.log('Extracted HTML content from response');
    } else {
      console.error('No content found in API response:', data);
      throw new Error('No content generated from the API');
    }
    
    // Clean up the HTML content
    const cleanedHtml = htmlContent.replace(/```html|```/g, '').trim();
    console.log('Cleaned HTML:', cleanedHtml + '...');
    
    // Return the HTML content
    return cleanedHtml;
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw error;
  }
}

// Updated alternative model function
async function tryAlternativeModel(prompt, apiKey, payload, pageUrl, pageTitle, pageContent) {
  console.log('Trying alternative Gemini model...');
  
  // List of alternative models to try
  const alternativeModels = [
    'gemini-1.5-pro',
    'gemini-1.0-pro',
    'gemini-pro'
  ];
  
  for (const model of alternativeModels) {
    try {
      console.log(`Attempting to use model: ${model}`);
      
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        console.error(`Model ${model} failed:`, await response.json());
        continue; // Try the next model
      }
      
      const data = await response.json();
      
      // Extract the HTML content from the response
      if (data.candidates && 
          data.candidates[0] && 
          data.candidates[0].content && 
          data.candidates[0].content.parts && 
          data.candidates[0].content.parts[0]) {
        const htmlContent = data.candidates[0].content.parts[0].text;
        // Clean up the HTML content
        const cleanedHtml = htmlContent.replace(/```html|```/g, '').trim();
        console.log(`Successfully generated content with model ${model}`);
        return cleanedHtml;
      }
    } catch (error) {
      console.error(`Error with model ${model}:`, error);
    }
  }
  
  // If all models failed, create a basic HTML page as fallback
  console.log('All models failed, using fallback HTML');
  return createFallbackHtml(prompt, pageUrl);
}

// Create a fallback HTML page when all API calls fail
function createFallbackHtml(prompt, pageUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Modified Page</title>
  <style>
    body {
      font-family: 'Google Sans', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      color: #CF33FF;
    }
    .error-container {
      background-color: #f8f9fa;
      border-left: 4px solid #CF33FF;
      padding: 15px;
      margin: 20px 0;
    }
    .original-url {
      color: #666;
      font-style: italic;
    }
  </style>
</head>
<body>
  <h1>AI Web Modifier</h1>
  <p>Your request: "${prompt}"</p>
  
  <div class="error-container">
    <p>Sorry, we couldn't generate a custom page using the AI service. This is a fallback page.</p>
    <p>Please try again later or try a different request.</p>
  </div>
  
  <p class="original-url">Original page: <a href="${pageUrl}">${pageUrl}</a></p>
</body>
</html>`;
}

// Function to simplify HTML while preserving style information
function simplifyHtml(html) {
  // Create a DOM parser
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // 1. Remove scripts
  const scripts = doc.querySelectorAll('script');
  scripts.forEach(script => script.remove());
  
  
  // 3. Remove header elements (common selectors)
  const headerElements = doc.querySelectorAll('header, .header, #header, nav, .nav, #nav');
  headerElements.forEach(header => header.remove());
  
  // 4. Remove footer elements (common selectors)
  const footerElements = doc.querySelectorAll('footer, .footer, #footer');
  footerElements.forEach(footer => footer.remove());
  
  // 5. Get the simplified HTML
  let simplifiedHtml = doc.documentElement.outerHTML;
  
  
  return simplifiedHtml;
}

// New function to ask questions about the page
async function askQuestionAboutPage(question, apiKey) {
  try {
    console.log('Starting question answering with question:', question);
    
    // If no API key was provided, try to get it from config
    if (!apiKey) {
      try {
        apiKey = await chrome.runtime.sendMessage({action: 'getApiKey'});
        console.log('Got API key from background script');
      } catch (error) {
        console.error('Failed to get API key:', error);
        throw new Error('No API key provided. Please enter an API key in the extension popup.');
      }
    }
    
    // Get the current page URL and HTML content
    const pageUrl = window.location.href;
    const pageTitle = document.title;
    const pageContent = document.documentElement.outerHTML;
    
    console.log('Current page URL:', pageUrl);
    
    // Use Gemini API to answer the question
    console.log('Using Gemini API to answer question...');
    return await answerQuestionWithGeminiAPI(question, apiKey, pageUrl, pageTitle, pageContent);
  } catch (error) {
    console.error('Error answering question:', error);
    throw error;
  }
}

// Function to use Gemini API to answer questions about the page
async function answerQuestionWithGeminiAPI(question, apiKey, pageUrl, pageTitle, pageContent) {
  try {
    console.log('Starting Gemini API request for question...');
    
    // Validate API key format
    if (!apiKey || !apiKey.startsWith('AIza')) {
      console.error('Invalid API key format. API keys should start with "AIza"');
      throw new Error('Invalid API key format. Please check your API key.');
    }
    
    // Log a masked version of the API key for debugging (showing only first 8 chars)
    const maskedKey = apiKey.substring(0, 8) + '...';
    console.log(`Using API key: ${maskedKey}`);
    
    // Prepare the prompt for the AI
    const systemPrompt = "You are a helpful assistant that answers questions about web pages. "
      + "You will be given the HTML content of a web page and a question about it. "
      + "Your task is to analyze the page content and provide a clear, concise answer to the question. "
      + "Focus on being accurate and helpful. If the answer cannot be determined from the page content, say so.";
    
    // Create a simplified version of the HTML to reduce token count
    const simplifiedHtml = simplifyHtml(pageContent);
    
    const userPrompt = `
      I am on a web page with the URL: ${pageUrl}
      Title: ${pageTitle}
      
      My question is: "${question}"
      
      Here is the HTML content of the page:
      ${simplifiedHtml}
      
      Please answer my question based on the content of this page.
    `;
    
    console.log('Calling Gemini API for question answering...');
    
    // Prepare the payload according to the Gemini API format
    const payload = {
      contents: [
        {
          parts: [
            { text: systemPrompt },
            { text: userPrompt }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2
      }
    };
    
    // Use Gemini 1.5 Flash for better performance
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    console.log('Using API URL:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('API response error:', errorData);
      
      // Better error handling for API key issues
      if (errorData.error && errorData.error.status === 'INVALID_ARGUMENT') {
        throw new Error('Invalid API key. Please check your API key and make sure it is enabled for Gemini API.');
      }
      
      if (errorData.error && errorData.error.status === 'PERMISSION_DENIED') {
        throw new Error('Permission denied. Your API key may not have access to Gemini API or has restrictions.');
      }
      
      throw new Error(errorData.error?.message || 'API request failed');
    }
    
    const data = await response.json();
    console.log('API response received for question:', data);
    
    // Extract the answer from the response
    let answer = '';
    if (data.candidates && 
        data.candidates[0] && 
        data.candidates[0].content && 
        data.candidates[0].content.parts && 
        data.candidates[0].content.parts[0]) {
      answer = data.candidates[0].content.parts[0].text;
      console.log('Extracted answer from response');
    } else {
      console.error('No content found in API response:', data);
      throw new Error('No answer generated from the API');
    }
    
    return answer;
  } catch (error) {
    console.error('Error calling Gemini API for question:', error);
    throw error;
  }
}

// Function to create and show the permission banner
function showMicrophonePermissionBanner() {
  console.log('[content.js] Creating microphone permission banner');
  
  // Check if banner already exists
  if (document.getElementById('ai-modifier-permission-banner')) {
    console.log('[content.js] Banner already exists, removing old one');
    document.getElementById('ai-modifier-permission-banner').remove();
  }
  
  // Create banner element
  const banner = document.createElement('div');
  banner.id = 'ai-modifier-permission-banner';
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background-color: #303134;
    color: #e8eaed;
    padding: 12px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 2147483647;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    border-bottom: 1px solid #3c4043;
    font-family: 'Google Sans', Arial, sans-serif;
    font-size: 14px;
  `;
  
  // Create message
  const message = document.createElement('span');
  message.textContent = 'AI Web Modifier needs microphone access for speech recognition';
  
  // Create button
  const button = document.createElement('button');
  button.textContent = 'Enable Microphone';
  button.style.cssText = `
    background-color: #CF33FF;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    font-family: 'Google Sans', Arial, sans-serif;
    font-size: 14px;
    cursor: pointer;
    margin-left: 16px;
  `;
  
  // Create close button
  const closeButton = document.createElement('button');
  closeButton.textContent = '✕';
  closeButton.style.cssText = `
    background: none;
    border: none;
    color: #9aa0a6;
    font-size: 16px;
    cursor: pointer;
    margin-left: 16px;
    padding: 4px 8px;
  `;
  
  // Add event listeners
  button.addEventListener('click', function() {
    console.log('[content.js] Permission button clicked, requesting microphone');
    // Request microphone permission
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(function(stream) {
        console.log('[content.js] Microphone permission granted');
        // Permission granted
        stream.getTracks().forEach(track => track.stop()); // Stop the stream
        banner.remove();
        
        // Notify the popup that permission is granted
        chrome.runtime.sendMessage({ 
          action: 'microphonePermissionGranted' 
        });
      })
      .catch(function(err) {
        console.error('[content.js] Microphone permission denied:', err);
        
        // Notify the popup that permission is denied
        chrome.runtime.sendMessage({ 
          action: 'microphonePermissionDenied',
          error: err.message
        });
      });
  });
  
  closeButton.addEventListener('click', function() {
    console.log('[content.js] Permission banner closed by user');
    banner.remove();
    
    // Notify the popup that the banner was dismissed
    chrome.runtime.sendMessage({ 
      action: 'microphonePermissionDismissed'
    });
  });
  
  // Assemble and add to page
  banner.appendChild(message);
  banner.appendChild(button);
  banner.appendChild(closeButton);
  
  // Make sure we have a body to append to
  if (document.body) {
    document.body.appendChild(banner);
    console.log('[content.js] Banner added to page');
  } else {
    console.error('[content.js] Cannot add banner - document.body not available');
    // Try to add it when the body becomes available
    document.addEventListener('DOMContentLoaded', () => {
      document.body.appendChild(banner);
      console.log('[content.js] Banner added to page after DOMContentLoaded');
    });
  }
  
  // Return a promise that resolves when permission is granted
  return new Promise((resolve, reject) => {
    button.addEventListener('click', function() {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function(stream) {
          stream.getTracks().forEach(track => track.stop());
          banner.remove();
          chrome.runtime.sendMessage({ action: 'microphonePermissionGranted' });
        })
        .catch(function(err) {
          chrome.runtime.sendMessage({ 
            action: 'microphonePermissionDenied',
            error: err.message
          });
        });
    });
    
    closeButton.addEventListener('click', function() {
      reject(new Error('User dismissed permission banner'));
    });
  });
}

function injectMicButton() {
  if (document.getElementById('ai-mic-btn')) return;
  
  // Create a container for better styling
  const container = document.createElement('div');
  container.id = 'ai-mic-permission-container';
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100%';
  container.style.background = '#1976d2';
  container.style.color = '#fff';
  container.style.padding = '10px';
  container.style.zIndex = '2147483647';
  container.style.textAlign = 'center';
  container.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
  
  // Add text explanation
  const text = document.createElement('div');
  text.textContent = 'The AI Web Modifier extension needs microphone access for speech-to-text.';
  text.style.marginBottom = '10px';
  text.style.fontSize = '16px';
  
  // Create the button
  const btn = document.createElement('button');
  btn.id = 'ai-mic-btn';
  btn.textContent = 'Enable Microphone Access';
  btn.style.padding = '8px 16px';
  btn.style.fontSize = '16px';
  btn.style.fontWeight = 'bold';
  btn.style.background = '#ffffff';
  btn.style.color = '#1976d2';
  btn.style.border = 'none';
  btn.style.borderRadius = '4px';
  btn.style.cursor = 'pointer';
  btn.style.margin = '0 auto';
  btn.style.display = 'block';
  
  // Add hover effect
  btn.onmouseover = () => {
    btn.style.background = '#f0f0f0';
  };
  btn.onmouseout = () => {
    btn.style.background = '#ffffff';
  };
  
  // Add click handler
  btn.onclick = () => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        stream.getTracks().forEach(track => track.stop());
        
        // Create success message
        container.style.background = '#4caf50';
        text.textContent = 'Microphone access granted! You can now use the speech-to-text feature.';
        btn.textContent = 'Close This Message';
        btn.onclick = () => container.remove();
      })
      .catch(err => {
        // Create error message
        container.style.background = '#f44336';
        text.textContent = 'Microphone access was denied: ' + err.name;
        btn.textContent = 'Try Again';
        btn.onclick = () => {
          container.remove();
          injectMicButton();
        };
      });
  };
  
  // Assemble and inject
  container.appendChild(text);
  container.appendChild(btn);
  document.body.appendChild(container);
}

// Listen for permission changes
navigator.permissions.query({ name: 'microphone' }).then(permissionStatus => {
  if (permissionStatus.state !== 'granted') {
    showMicrophonePermissionBanner();
  }
  permissionStatus.onchange = () => {
    if (permissionStatus.state === 'granted') {
      const banner = document.getElementById('ai-modifier-permission-banner');
      if (banner) banner.remove();
      chrome.runtime.sendMessage({ action: 'microphonePermissionGranted' });
    }
    if (permissionStatus.state === 'denied') {
      showMicrophonePermissionBanner();
      chrome.runtime.sendMessage({ action: 'microphonePermissionDenied' });
    }
  };
});