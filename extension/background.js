// This background script can be used for handling events that need to persist
// beyond the lifetime of the popup or content scripts

// Background script for AI Web Modifier
console.log('Background script loaded - version 1.0.9');

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Background received message:', request, 'from sender:', sender);
  
  if (request.action === 'getApiKey') {
    // Try to get the working API key first
    chrome.storage.local.get(['workingApiKey', 'geminiApiKey'], function(result) {
      if (result.workingApiKey) {
        sendResponse(result.workingApiKey);
      } else if (result.geminiApiKey) {
        sendResponse(result.geminiApiKey);
      } else {
        // Try sync storage as fallback
        chrome.storage.sync.get('geminiApiKey', function(syncResult) {
          sendResponse(syncResult.geminiApiKey || '');
        });
      }
    });
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'getApiKeys') {
    // Try to get from both local and sync storage
    chrome.storage.local.get(['geminiApiKey', 'workingApiKey', 'geminiModel', 'geminiVersion'], function(localResult) {
      const response = {
        geminiApiKey: localResult.workingApiKey || localResult.geminiApiKey || '',
        geminiModel: localResult.geminiModel || 'gemini-1.5-pro',
        geminiVersion: localResult.geminiVersion || 'v1'
      };
      
      if (response.geminiApiKey) {
        sendResponse(response);
      } else {
        // If not in local storage, try sync storage
        chrome.storage.sync.get(['geminiApiKey'], function(syncResult) {
          response.geminiApiKey = syncResult.geminiApiKey || '';
          sendResponse(response);
        });
      }
    });
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'logDebug') {
    console.log('Debug:', request.message);
    sendResponse({success: true});
  }

  // This was for a direct speech result from a different approach, might not be used with iframe
  if (request.action === 'speechResult') { 
    console.log('[background.js] Forwarding speechResult to popup.');
    chrome.runtime.sendMessage(request); 
  }

  // Forward permission messages from content script (or iframe via content script) to popup
  if (request.type === 'PERMISSION_GRANTED' || request.type === 'PERMISSION_DENIED') {
    console.log('[background.js] Forwarding permission status to popup:', request.type);
    chrome.runtime.sendMessage(request);
  }
  
  if (request.action === 'logError') {
    console.error('Extension error:', request.error);
    sendResponse({logged: true});
  }
  
  // New handler for opening the permission page
  if (request.action === 'openPermissionPage') {
    console.log('[background.js] Opening permission page');
    // Create a new tab with the permission page
    chrome.tabs.create({
      url: chrome.runtime.getURL('test.html')
    }, function(tab) {
      console.log('[background.js] Permission page opened in tab:', tab.id);
      sendResponse({success: true, tabId: tab.id});
    });
    return true; // Keep the message channel open for async response
  }
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