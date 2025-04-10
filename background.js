(function() {
  'use strict';

// Environment Switcher background script

// Initialize default settings when extension is installed
chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === 'install') {
    // Default settings
    chrome.storage.sync.set({
      projects: [
        {
          name: "Example Project",
          domains: ["dev.example.com", "stage.example.com", "www.example.com"],
          floatingEnabled: false
        }
      ],
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
      incognitoMode: false,
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
  
  // Handle opening a URL in an incognito window
  if (message.action === 'openIncognito') {
    // Create a new incognito window with the provided URL
    chrome.windows.create({
      url: message.url,
      incognito: true
    });
    return true;
  }
});

// Detect environments based on hostname patterns
function detectEnvironments(hostname) {
  const environments = [];
  
  return environments;
}

// Find which project a domain belongs to
function findProjectForDomain(hostname, projects) {
  for (const project of projects) {
    if (project.domains.includes(hostname)) {
      return project;
    }
  }
  return null;
}

})();