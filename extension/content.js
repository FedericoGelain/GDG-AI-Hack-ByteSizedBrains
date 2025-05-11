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
  } else if (request.action === 'testApiKey') {
    console.log('Received test API key request');
    testApiKeyDirectly(request.apiKey)
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
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

// Add this function to directly test the API key
async function testApiKeyDirectly(apiKey) {
  try {
    console.log('Testing API key directly...');
    
    // Try multiple endpoints
    const endpoints = [
      { version: 'v1', model: 'gemini-1.5-pro' },
      { version: 'v1', model: 'gemini-1.0-pro' },
      { version: 'v1', model: 'gemini-pro' },
      { version: 'v1beta', model: 'gemini-pro' }
    ];
    
    for (const endpoint of endpoints) {
      try {
        const testEndpoint = `https://generativelanguage.googleapis.com/${endpoint.version}/models/${endpoint.model}:generateContent?key=${apiKey}`;
        console.log(`Testing endpoint: ${testEndpoint}`);
        
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
        
        const response = await fetch(testEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(testPayload)
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('API test successful with endpoint:', endpoint);
          console.log('Response:', data);
          
          // Save the working configuration
          chrome.storage.local.set({
            geminiModel: endpoint.model,
            geminiVersion: endpoint.version,
            workingApiKey: apiKey
          });
          
          return {
            success: true,
            model: endpoint.model,
            version: endpoint.version
          };
        } else {
          const errorText = await response.text();
          console.error(`API test failed for ${endpoint.model} (${endpoint.version}):`, errorText);
        }
      } catch (error) {
        console.error(`Error testing endpoint ${endpoint.model} (${endpoint.version}):`, error);
      }
    }
    
    return { success: false, error: 'All API endpoints failed' };
  } catch (error) {
    console.error('Error testing API key:', error);
    return { success: false, error: error.message };
  }
}

// Modify the modifyPageWithAI function to include direct testing
async function modifyPageWithAI(prompt, apiKey) {
  try {
    console.log('Starting page modification with prompt:', prompt);
    
    // If no API key was provided, try to get it from storage
    if (!apiKey) {
      try {
        // Try to get the API key from multiple sources
        const response = await chrome.runtime.sendMessage({action: 'getApiKeys'});
        console.log('Got API keys response:', response);
        
        if (response && response.geminiApiKey) {
          apiKey = response.geminiApiKey;
          console.log('Using API key from getApiKeys:', apiKey.substring(0, 10) + '...');
        } else {
          // Try the older method
          apiKey = await chrome.runtime.sendMessage({action: 'getApiKey'});
          console.log('Using API key from getApiKey:', apiKey.substring(0, 10) + '...');
        }
        
        if (!apiKey) {
          throw new Error('No API key found in storage');
        }
      } catch (error) {
        console.error('Failed to get API key:', error);
        throw new Error('No API key provided. Please enter an API key in the extension settings.');
      }
    }
    
    // Test the API key directly
    console.log('Testing API key before use...');
    const testResult = await testApiKeyDirectly(apiKey);
    
    if (!testResult.success) {
      throw new Error(`API key test failed: ${testResult.error}`);
    }
    
    console.log('API key test successful, using model:', testResult.model, 'version:', testResult.version);
    
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

// Function to use Gemini API to modify the page
async function modifyPageWithGeminiAPI(prompt, apiKey, pageUrl, pageTitle, pageContent) {
  try {
    console.log('Preparing Gemini API request...');
    
    // Get the saved model and version information
    const modelInfo = await chrome.storage.local.get(['geminiModel', 'geminiVersion', 'workingApiKey']);
    
    // Use the stored working API key if available and no key was provided
    if (!apiKey && modelInfo.workingApiKey) {
      apiKey = modelInfo.workingApiKey;
      console.log('Using stored working API key');
    }
    
    const model = modelInfo.geminiModel || 'gemini-1.5-pro';
    const version = modelInfo.geminiVersion || 'v1';
    
    console.log(`Using model: ${model}, version: ${version}`);
    
    // Prepare a simplified version of the page content to avoid token limits
    const simplifiedContent = simplifyHtml(pageContent);
    
    // Construct the API endpoint based on saved information
    const apiEndpoint = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;
    
    // Prepare the request payload
    const payload = {
      contents: [
        {
          parts: [
            {
              text: `You are an AI assistant that helps modify web pages based on user instructions.
              
Current webpage: ${pageUrl}
Page title: ${pageTitle}

Here's a simplified version of the current page HTML:
${simplifiedContent}

User request: ${prompt}

Please generate the modified HTML for this page based on the user's request. 
Only include the HTML that should replace the current page content.
Do not include explanations or markdown formatting, just the raw HTML and css.
Focus on readability and contect structure,s generate a clean and organized content 
that can be red from anyone also people with disabilities. You must use css to improve the ui.
DO not use all the page widht. Apply css rules to change the page layout.
Center the content horizontally in the page and do not use all the width but try to compact it on the middle.
You must not use all the width but center the text in the middle like a column in the center of the page. This is an important rule you cannot ovverride`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    };
    
    console.log('Sending request to Gemini API...');
    
    // Make the API request
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    // If the request fails, try alternative endpoints
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      
      // Try alternative endpoints if the model is not found
      if (errorText.includes('NOT_FOUND') || errorText.includes('not found')) {
        return await tryAlternativeEndpoints(prompt, apiKey, pageUrl, pageTitle, simplifiedContent);
      }
      
      // Check for specific error messages
      if (errorText.includes('API key')) {
        throw new Error('Invalid API key. Please check your Gemini API key in the extension settings.');
      } else if (errorText.includes('quota')) {
        throw new Error('API quota exceeded. Please try again later or use a different API key.');
      } else if (errorText.includes('permission')) {
        throw new Error('API key does not have permission to access Gemini. Please enable the Gemini API in your Google Cloud Console.');
      }
      
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }
    
    // Parse the response
    const data = await response.json();
    console.log('Received response from Gemini API');
    
    // Extract the generated HTML
    if (data.candidates && data.candidates[0] && data.candidates[0].content && 
        data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
      const generatedHtml = data.candidates[0].content.parts[0].text;
      return generatedHtml;
    } else {
      throw new Error('Unexpected response format from Gemini API');
    }
  } catch (error) {
    console.error('Error using Gemini API:', error);
    throw error;
  }
}

// Try alternative API endpoints if the first one fails
async function tryAlternativeEndpoints(prompt, apiKey, pageUrl, pageTitle, simplifiedContent) {
  // List of possible endpoints to try
  const endpoints = [
    { version: 'v1', model: 'gemini-pro' },
    { version: 'v1beta', model: 'gemini-pro' },
    { version: 'v1', model: 'gemini-1.0-pro' },
    { version: 'v1beta', model: 'gemini-1.0-pro' }
  ];
  
  // Try each endpoint until one works
  for (const endpoint of endpoints) {
    try {
      console.log(`Trying alternative endpoint: ${endpoint.version}/models/${endpoint.model}`);
      
      const apiEndpoint = `https://generativelanguage.googleapis.com/${endpoint.version}/models/${endpoint.model}:generateContent?key=${apiKey}`;
      
      const payload = {
        contents: [
          {
            parts: [
              {
                text: `You are an AI assistant that helps modify web pages based on user instructions.
                
Current webpage: ${pageUrl}
Page title: ${pageTitle}

Here's a simplified version of the current page HTML:
${simplifiedContent}

User request: ${prompt}

Please generate the modified HTML for this page based on the user's request. 
Only include the HTML that should replace the current page content.
Do not include explanations or markdown formatting, just the raw HTML and css`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        }
      };
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        // Save the working endpoint for future use
        chrome.storage.local.set({ 
          geminiModel: endpoint.model, 
          geminiVersion: endpoint.version 
        });
        
        const data = await response.json();
        
        if (data.candidates && data.candidates[0] && data.candidates[0].content && 
            data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
          return data.candidates[0].content.parts[0].text;
        }
      }
    } catch (error) {
      console.error(`Error with endpoint ${endpoint.version}/${endpoint.model}:`, error);
      // Continue to the next endpoint
    }
  }
  
  // If all endpoints fail, throw an error
  throw new Error('All Gemini API endpoints failed. Please check your API key and make sure Gemini API is enabled.');
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
  return new Promise((resolve, reject) => {
    console.log('[content.js] Showing microphone permission banner');
    
    // Try to request permission directly first
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        console.log('[content.js] Microphone access granted directly');
        stream.getTracks().forEach(track => track.stop());
        chrome.runtime.sendMessage({ type: 'PERMISSION_GRANTED' });
        resolve();
      })
      .catch(error => {
        console.error('[content.js] Direct permission request failed:', error);
        
        // If direct request fails, show the banner
        showPermissionUI(resolve, reject);
      });
  });
}

// Separate function to show the permission UI
function showPermissionUI(resolve, reject) {
  // Create a more visible permission request UI
  const permissionBanner = document.createElement('div');
  permissionBanner.style.position = 'fixed';
  permissionBanner.style.top = '0';
  permissionBanner.style.left = '0';
  permissionBanner.style.width = '100%';
  permissionBanner.style.padding = '15px';
  permissionBanner.style.backgroundColor = '#4285f4';
  permissionBanner.style.color = 'white';
  permissionBanner.style.textAlign = 'center';
  permissionBanner.style.zIndex = '9999999';
  permissionBanner.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
  permissionBanner.style.display = 'flex';
  permissionBanner.style.justifyContent = 'center';
  permissionBanner.style.alignItems = 'center';
  
  permissionBanner.innerHTML = `
    <div style="flex: 1; text-align: center;">
      <strong>Microphone Access Required</strong>
      <p>This extension needs microphone access for speech recognition.</p>
    </div>
    <div style="display: flex; gap: 10px;">
      <button id="grantMicAccess" style="background: white; color: #4285f4; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold;">Grant Access</button>
      <button id="denyMicAccess" style="background: transparent; color: white; border: 1px solid white; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Deny</button>
    </div>
  `;
  
  document.body.appendChild(permissionBanner);
  
  // Add event listeners to the buttons
  document.getElementById('grantMicAccess').addEventListener('click', function() {
    console.log('[content.js] Grant access button clicked');
    
    // Open the test.html page in a new tab
    const testUrl = chrome.runtime.getURL('test.html');
    window.open(testUrl, '_blank');
    
    // Remove the banner
    permissionBanner.remove();
    
    // We'll consider this a success for now
    resolve();
  });
  
  document.getElementById('denyMicAccess').addEventListener('click', function() {
    console.log('[content.js] Deny access button clicked');
    
    // Remove the banner
    permissionBanner.remove();
    
    // Notify the extension that permission was dismissed
    chrome.runtime.sendMessage({ type: 'PERMISSION_DISMISSED' });
    
    reject(new Error('Microphone access denied by user'));
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