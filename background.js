// Environment Switcher background script

// Initialize default settings when extension is installed
chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === 'install') {
    // Default settings
    chrome.storage.sync.set({
      domains: [],
      protocolRules: [
        '*.dev.example.com|https',
        '*.stage.example.com|https'
      ],
      detectors: {
      },
      showProtocol: true,
      autoCollapse: true,
      autoRedirect: true,
      newWindow: false,
      floatingEnabled: false,
      collapsedState: true
    }, function() {
      console.log('Default settings initialized');
    });
  }
});

// Listen for messages from popup or options page
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.action === 'detectEnvironments') {
    // Detect environments in the current tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length > 0) {
        const url = new URL(tabs[0].url);
        const hostname = url.hostname;
        
        // Detect environments based on hostname
        const environments = detectEnvironments(hostname);
        
        sendResponse({ environments: environments });
      }
    });
    
    // Return true to indicate we'll respond asynchronously
    return true;
  }
});

// Detect environments based on hostname patterns
function detectEnvironments(hostname) {
  const environments = [];
  
  return environments;
}