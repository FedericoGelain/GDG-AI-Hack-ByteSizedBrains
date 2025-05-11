// This script runs in the test.html page to request microphone permissions

document.addEventListener('DOMContentLoaded', function() {
  console.log('[test.js] Permission page loaded');
  
  const requestMicButton = document.getElementById('requestMicButton');
  const statusMessage = document.getElementById('statusMessage');
  
  if (requestMicButton) {
    requestMicButton.addEventListener('click', function() {
      console.log('[test.js] Request microphone button clicked');
      
      // Show that we're processing
      statusMessage.textContent = 'Requesting microphone access...';
      statusMessage.style.display = 'block';
      statusMessage.style.backgroundColor = '#e2e3e5';
      statusMessage.style.color = '#383d41';
      
      // Request microphone permission
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          console.log('[test.js] Microphone permission granted');
          
          // Stop all tracks to release the microphone
          stream.getTracks().forEach(track => track.stop());
          
          // Show success message
          statusMessage.textContent = 'Microphone access granted! You can now close this tab and return to using the extension.';
          statusMessage.style.display = 'block';
          statusMessage.style.backgroundColor = '#d4edda';
          statusMessage.style.color = '#155724';
          
          // Notify the extension that permission was granted
          chrome.runtime.sendMessage({ type: 'PERMISSION_GRANTED' });
          
          // Update button
          requestMicButton.textContent = 'Permission Granted!';
          requestMicButton.style.backgroundColor = '#28a745';
          
          // Add a close button for convenience
          const closeButton = document.createElement('button');
          closeButton.textContent = 'Close This Tab';
          closeButton.style.backgroundColor = '#6c757d';
          closeButton.style.color = 'white';
          closeButton.style.border = 'none';
          closeButton.style.padding = '12px 24px';
          closeButton.style.fontSize = '16px';
          closeButton.style.borderRadius = '4px';
          closeButton.style.cursor = 'pointer';
          closeButton.style.marginTop = '20px';
          closeButton.style.marginLeft = '10px';
          
          closeButton.addEventListener('click', function() {
            window.close();
          });
          
          // Add the close button next to the existing button
          requestMicButton.parentNode.appendChild(closeButton);
        })
        .catch(err => {
          console.error('[test.js] Microphone permission denied:', err);
          
          // Show error message
          statusMessage.textContent = 'Microphone access was denied: ' + err.name + '. Please check your browser settings and try again.';
          statusMessage.style.display = 'block';
          statusMessage.style.backgroundColor = '#f8d7da';
          statusMessage.style.color = '#721c24';
          
          // Notify the extension that permission was denied
          chrome.runtime.sendMessage({ 
            type: 'PERMISSION_DENIED', 
            error: err.message || 'Microphone access denied'
          });
          
          // Update button
          requestMicButton.textContent = 'Try Again';
          requestMicButton.style.backgroundColor = '#dc3545';
          
          // Add instructions for enabling microphone in browser settings
          const instructionsDiv = document.createElement('div');
          instructionsDiv.style.marginTop = '20px';
          instructionsDiv.style.padding = '15px';
          instructionsDiv.style.backgroundColor = '#fff3cd';
          instructionsDiv.style.color = '#856404';
          instructionsDiv.style.borderRadius = '4px';
          instructionsDiv.style.textAlign = 'left';
          
          instructionsDiv.innerHTML = `
            <h3>How to enable microphone access:</h3>
            <ol>
              <li>Click the lock/info icon in the address bar</li>
              <li>Find "Microphone" in the site settings</li>
              <li>Change the setting to "Allow"</li>
              <li>Refresh this page and try again</li>
            </ol>
          `;
          
          document.querySelector('.container').appendChild(instructionsDiv);
        });
    });
    
    // Auto-click the button to request permission immediately
    // Uncomment this if you want the permission dialog to appear automatically
    // requestMicButton.click();
  }
}); 