// Content script for AI Web Modifier
console.log('Content script loaded - version 1.0.8');

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Content script received message:', request);
  if (request.action === 'modifyPage') {
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
    return true; // Required for async sendResponse
  }
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

async function modifyPageWithAI(prompt, apiKey) {
  try {
    console.log('Starting page modification with prompt:', prompt);
    
    // Get the complete page content with important elements
    const pageContent = getCompletePageContent();
    console.log('Generated complete page content');
    
    // Prepare the prompt for the AI
    const systemPrompt = "You are a helpful assistant that generates HTML content. Return a complete HTML page based on the user's request. Include a proper DOCTYPE, html, head, and body tags. Make sure the HTML is valid and complete.";
    
    const userPrompt = `
      I have a web page with the following content:
      ${pageContent}
      
      User request: "${prompt}"
      
      Please provide a complete HTML page that fulfills this request.
      Return only valid HTML without any explanations or markdown.
      Make sure to include DOCTYPE, html, head with title, and body tags.
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
        temperature: 0.7,
        maxOutputTokens: 8192
      }
    };
    
    // Call the Gemini API using fetch with the correct model name
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
      
      // If the model is not found, try an alternative model
      if (errorData.error && errorData.error.message && 
          errorData.error.message.includes('not found for API version')) {
        console.log('Trying alternative model...');
        return tryAlternativeModel(prompt, apiKey, payload);
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
    console.log('Cleaned HTML:', cleanedHtml);
    
    // Return the HTML content
    return cleanedHtml;
    
  } catch (error) {
    console.error('Error modifying page:', error);
    throw error;
  }
}

// Function to get complete page content, excluding headers and footers
function getCompletePageContent() {
  try {
    // Create a clone of the document to work with
    const clone = document.cloneNode(true);
    const body = clone.body;
    
    // Remove common header elements
    const headersToRemove = body.querySelectorAll('header, nav, .header, .navigation, .nav-bar, .navbar, .top-bar, #header, #nav');
    headersToRemove.forEach(header => {
      if (header && header.parentNode) {
        header.parentNode.removeChild(header);
      }
    });
    
    // Remove common footer elements
    const footersToRemove = body.querySelectorAll('footer, .footer, #footer, .bottom, .copyright, .site-info');
    footersToRemove.forEach(footer => {
      if (footer && footer.parentNode) {
        footer.parentNode.removeChild(footer);
      }
    });
    
    // Remove other non-essential elements
    const nonEssentialToRemove = body.querySelectorAll('.ads, .advertisement, .sidebar, .comments, .related-posts, script, style, noscript, iframe');
    nonEssentialToRemove.forEach(element => {
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
    
    // Get the main content
    const mainContent = body.querySelector('main, article, .content, #content, .main, #main');
    
    // If we found a main content container, use that, otherwise use the whole body
    const contentToUse = mainContent || body;
    
    // Extract the HTML content
    const contentHTML = contentToUse.innerHTML;
    
    // Extract text content for context
    const textContent = contentToUse.textContent.trim();
    
    // Create a structured representation of the page
    const pageStructure = {
      title: document.title,
      url: window.location.href,
      mainContent: textContent.substring(0, 5000), // Get up to 5000 characters of text
      htmlStructure: getStructuredHTML(contentToUse)
    };
    
    return JSON.stringify(pageStructure, null, 2);
  } catch (error) {
    console.error('Error getting page content:', error);
    return getSimplifiedPageStructure(); // Fallback to the simplified structure
  }
}

// Function to get a structured representation of HTML
function getStructuredHTML(element) {
  if (!element) return null;
  
  // Create a simplified representation of the element
  const result = {
    tag: element.tagName ? element.tagName.toLowerCase() : 'text',
    id: element.id || null,
    classes: element.className ? Array.from(element.classList).join(' ') : null,
    text: element.nodeType === Node.TEXT_NODE ? element.textContent.trim() : null
  };
  
  // Add attributes if they exist
  if (element.attributes && element.attributes.length > 0) {
    result.attributes = {};
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      if (attr.name !== 'id' && attr.name !== 'class') {
        result.attributes[attr.name] = attr.value;
      }
    }
  }
  
  // Add children if they exist
  if (element.childNodes && element.childNodes.length > 0) {
    result.children = [];
    
    // Process only the first 50 children to avoid excessive size
    const childLimit = Math.min(element.childNodes.length, 50);
    
    for (let i = 0; i < childLimit; i++) {
      const child = element.childNodes[i];
      
      // Skip empty text nodes
      if (child.nodeType === Node.TEXT_NODE && (!child.textContent || !child.textContent.trim())) {
        continue;
      }
      
      const childStructure = getStructuredHTML(child);
      if (childStructure) {
        result.children.push(childStructure);
      }
    }
    
    // Indicate if there are more children
    if (element.childNodes.length > childLimit) {
      result.children.push({ tag: 'more', text: `...and ${element.childNodes.length - childLimit} more elements...` });
    }
  }
  
  return result;
}

// Try alternative models if the first one fails
async function tryAlternativeModel(prompt, apiKey, payload) {
  // List of models to try in order
  const models = [
    'gemini-1.0-pro',
    'gemini-pro-vision',
    'gemini-1.5-pro',
    'gemini-1.5-flash-latest'
  ];
  
  for (const model of models) {
    try {
      console.log(`Trying model: ${model}`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Alternative model succeeded:', model);
        
        // Extract the HTML content from the response
        let htmlContent = '';
        if (data.candidates && 
            data.candidates[0] && 
            data.candidates[0].content && 
            data.candidates[0].content.parts && 
            data.candidates[0].content.parts[0]) {
          htmlContent = data.candidates[0].content.parts[0].text;
          
          // Clean up the HTML content
          const cleanedHtml = htmlContent.replace(/```html|```/g, '').trim();
          return cleanedHtml;
        }
      }
    } catch (error) {
      console.error(`Error with model ${model}:`, error);
      // Continue to the next model
    }
  }
  
  // If all models failed
  throw new Error('All Gemini API models failed. Please check your API key and try again.');
}

// Keep the original simplified page structure function as a fallback
function getSimplifiedPageStructure() {
  // Create a simplified representation of the page structure
  // This helps the AI understand the page without sending the entire HTML
  
  const structure = {
    title: document.title,
    url: window.location.href,
    headings: [],
    mainContent: '',
    forms: [],
    links: [],
    domStructure: getDOMStructure(document.body, 3) // Get DOM structure with limited depth
  };
  
  // Get headings
  const headings = document.querySelectorAll('h1, h2, h3');
  headings.forEach(heading => {
    structure.headings.push({
      level: heading.tagName.toLowerCase(),
      text: heading.textContent.trim(),
      id: heading.id || null
    });
  });
  
  // Get main content (simplified)
  const mainContent = document.querySelector('main') || document.querySelector('article') || document.body;
  structure.mainContent = mainContent.textContent.substring(0, 500) + '...';
  
  // Get forms
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    const formInputs = [];
    form.querySelectorAll('input, select, textarea').forEach(input => {
      formInputs.push({
        type: input.type || input.tagName.toLowerCase(),
        name: input.name || null,
        id: input.id || null
      });
    });
    
    structure.forms.push({
      id: form.id || null,
      action: form.action || null,
      inputs: formInputs
    });
  });
  
  // Get important links
  const links = document.querySelectorAll('a');
  const linkLimit = 20;
  let linkCount = 0;
  
  links.forEach(link => {
    if (linkCount < linkLimit && link.textContent.trim()) {
      structure.links.push({
        text: link.textContent.trim(),
        href: link.href,
        id: link.id || null
      });
      linkCount++;
    }
  });
  
  return JSON.stringify(structure, null, 2);
}

// Function to get a simplified DOM structure with limited depth
function getDOMStructure(element, maxDepth, currentDepth = 0) {
  if (!element || currentDepth >= maxDepth) {
    return null;
  }
  
  const result = {
    tag: element.tagName.toLowerCase(),
    id: element.id || null,
    classes: Array.from(element.classList).join(' ') || null
  };
  
  if (element.children.length > 0) {
    result.children = [];
    Array.from(element.children).slice(0, 10).forEach(child => {
      const childStructure = getDOMStructure(child, maxDepth, currentDepth + 1);
      if (childStructure) {
        result.children.push(childStructure);
      }
    });
    
    if (element.children.length > 10) {
      result.children.push({ tag: '...more elements...' });
    }
  }
  
  return result;
} 