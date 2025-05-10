document.getElementById('recordButton').addEventListener('click', () => {
  chrome.windows.create({
    url: chrome.runtime.getURL('recorder.html'),
    type: 'popup',
    width: 400,
    height: 200,
    left: screen.width - 420  // Position on right side
  });
});