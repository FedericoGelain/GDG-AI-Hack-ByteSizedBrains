// This background script can be used for handling events that need to persist
// beyond the lifetime of the popup or content scripts

// Background script for AI Web Modifier
console.log('Background script loaded - version 1.0.9');

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Background received message:', request, 'from sender:', sender);
  
  if (request.action === 'getApiKey') {
    chrome.storage.local.get('geminiApiKey', function(result) {
      sendResponse(result.geminiApiKey || '');
    });
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'getApiKeys') {
    chrome.storage.local.get(['geminiApiKey'], function(result) {
      sendResponse({
        geminiApiKey: result.geminiApiKey || ''
      });
    });
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'logDebug') {
    console.log('Debug:', request.message);
    sendResponse({success: true});
    // return true; // Not async, not strictly needed but fine
  }

  // This was for a direct speech result from a different approach, might not be used with iframe
  if (request.action === 'speechResult') { 
    console.log('[background.js] Forwarding speechResult to popup.');
    chrome.runtime.sendMessage(request); 
  }

  // Forward permission messages from content script (or iframe via content script) to popup
  if (request.type === 'PERMISSION_GRANTED' || request.type === 'PERMISSION_DENIED') {
    console.log('[background.js] Forwarding permission status to popup:', request.type);
    // Check if the sender is the content script (optional, but good for clarity)
    // if (sender.tab) { // Messages from content scripts have sender.tab
        chrome.runtime.sendMessage(request); // Forwards to all parts of the extension, popup will pick it up
    // }
  }
  
  if (request.action === 'logError') {
    console.error('Extension error:', request.error);
    sendResponse({logged: true});
    // return true; // Not async
  }
  // If you're not sending an async response for all paths, you don't always need to return true.
  // Only return true if you intend to call sendResponse later.
});

// When extension is installed or updated
chrome.runtime.onInstalled.addListener(function(details) {
  console.log('Extension installed or updated:', details.reason);
});

// Inject content script when a tab is activated
chrome.tabs.onActivated.addListener(function(activeInfo) {
  chrome.tabs.get(activeInfo.tabId, function(tab) {
    // Skip chrome:// pages, extension pages, etc.
    if (tab.url.startsWith('http')) {
      chrome.scripting.executeScript({
        target: {tabId: tab.id},
        files: ['content.js']
      }).catch(err => console.error("Error injecting content script:", err));
    }
  });
});

// Also inject when a tab is updated (page load/navigation)
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete' && tab.url.startsWith('http')) {
    chrome.scripting.executeScript({
      target: {tabId: tabId},
      files: ['content.js']
    }).catch(err => console.error("Error injecting content script:", err));
  }
}); 