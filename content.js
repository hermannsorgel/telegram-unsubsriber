window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data && event.data.type === 'TG_CLEANER_LOG') {
    chrome.runtime.sendMessage(event.data, () => {
      if (chrome.runtime.lastError) {
        // Popup is closed; silently ignore
      }
    });
  }
});
