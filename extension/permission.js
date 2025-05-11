console.log('[permission.js] SCRIPT LOADED AND RUNNING INSIDE IFRAME on origin:', window.location.origin);

/**
 * Requests user permission for microphone access.
 */
function requestMicrophonePermission() {
  console.log("[permission.js] Requesting microphone permission via getUserMedia...");
  
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      console.log("[permission.js] Microphone access GRANTED by user.");
      
      // Stop the tracks to prevent the recording indicator from being shown
      stream.getTracks().forEach(function(track) {
        track.stop();
      });
      
      console.log("[permission.js] Posting PERMISSION_GRANTED to parent.");
      window.parent.postMessage({ type: 'PERMISSION_GRANTED' }, '*');
    })
    .catch(error => {
      console.error("Error requesting microphone permission", error);
      
      // Notify the parent window that permission was denied
      window.parent.postMessage({ 
        type: 'PERMISSION_DENIED', 
        error: error.name 
      }, '*');
    });
}

// Call the function to request microphone permission when the page loads
requestMicrophonePermission(); 