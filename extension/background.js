// This background script can be used for handling events that need to persist
// beyond the lifetime of the popup or content scripts

// Background script for AI Web Modifier
console.log('Background script loaded - version 1.0.9');

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Background received message:', request);
  
  if (request.action === 'getApiKey') {
    // Forward to config.js in the popup
    chrome.storage.sync.get('apiKey', function(result) {
      sendResponse(result.apiKey || '');
    });
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'logDebug') {
    console.log('Debug:', request.message);
    sendResponse({success: true});
    return true;
  }
});

// When extension is installed or updated
chrome.runtime.onInstalled.addListener(function(details) {
  console.log('Extension installed or updated:', details.reason);
});

// Listen for errors
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'logError') {
    console.error('Extension error:', request.error);
    sendResponse({logged: true});
    return true;
  }
}); 