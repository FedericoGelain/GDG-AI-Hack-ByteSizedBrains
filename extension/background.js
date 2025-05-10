// This background script can be used for handling events that need to persist
// beyond the lifetime of the popup or content scripts

chrome.runtime.onInstalled.addListener(function() {
  console.log('AI Web Modifier extension installed');
});

// Listen for errors
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'logError') {
    console.error('Extension error:', request.error);
    sendResponse({logged: true});
    return true;
  }
}); 