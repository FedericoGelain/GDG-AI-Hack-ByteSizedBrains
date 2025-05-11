// This will be executed when the test page loads
console.log("Test page loaded");

// Add a button to request microphone permission directly
const btn = document.createElement('button');
btn.textContent = 'Request Microphone Permission';
btn.style.padding = '10px';
btn.style.fontSize = '16px';
btn.onclick = () => {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      stream.getTracks().forEach(track => track.stop());
      btn.textContent = 'Permission Granted!';
      btn.style.background = 'green';
      btn.style.color = 'white';
    })
    .catch(err => {
      btn.textContent = 'Permission Denied: ' + err.name;
      btn.style.background = 'red';
      btn.style.color = 'white';
    });
};
document.body.appendChild(btn); 