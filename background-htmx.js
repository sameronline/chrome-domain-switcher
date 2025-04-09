// Environment Switcher background script (with htmx support)

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

// Listen for messages from popup, content scripts, or htmx extension
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  // Handle htmx requests
  if (message.action === 'htmx') {
    handleHtmxRequest(message, sender, sendResponse);
    return true; // Keep the message channel open for the async response
  }
  
  // Handle environment detection (from popup)
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

// Handle htmx requests from the chrome-ext extension
function handleHtmxRequest(message, sender, sendResponse) {
  const endpoint = message.endpoint;
  const values = message.values || {};
  
  console.log('Handling htmx request:', endpoint, values);
  
  switch (endpoint) {
    case 'toggle-collapse':
      // Toggle the collapsed state of the floating UI
      // Send a response that will toggle the class on the UI
      const isCollapsed = values.isCollapsed === 'true';
      const newClass = isCollapsed ? 'env-switcher-floating' : 'env-switcher-floating env-switcher-floating--collapsed';
      const toggleContent = `
        <div class="${newClass}" hx-ext="chrome-ext">
          <button class="env-switcher-floating__toggle"
                  hx-post="chrome-ext:/toggle-collapse"
                  hx-swap="outerHTML"
                  hx-target="closest .env-switcher-floating"
                  hx-vals='{"isCollapsed": "${!isCollapsed}"}'>
                  ${isCollapsed ? '⊖' : '⊕'}
          </button>
          ${isCollapsed ? '<div class="env-switcher-floating__content">...</div>' : ''}
        </div>
      `;
      
      // Update the collapsed state in storage
      chrome.storage.sync.set({ collapsedState: !isCollapsed });
      
      sendResponse({ content: toggleContent });
      break;
      
    case 'change-project':
      // Handle project change
      const projectName = values.projectName;
      
      // Load projects from storage
      chrome.storage.sync.get('projects', function(data) {
        const projects = data.projects || [];
        
        // Find the selected project
        const project = projects.find(p => p.name === projectName);
        
        if (project) {
          // Generate HTML for the domain select
          let domainSelectHtml = `
            <select class="env-switcher-floating__select domain-select"
                    id="domain-select"
                    hx-post="chrome-ext:/update-domain"
                    hx-trigger="change">
          `;
          
          // Add options for each domain
          for (const domainEntry of project.domains) {
            const domain = typeof domainEntry === 'string' ? domainEntry : domainEntry.domain;
            const label = typeof domainEntry === 'string' ? domainEntry : (domainEntry.label || domainEntry.domain);
            
            domainSelectHtml += `<option value="${domain}">${label}</option>`;
          }
          
          domainSelectHtml += '</select>';
          
          sendResponse({ content: domainSelectHtml });
        } else {
          sendResponse({ error: 'Project not found' });
        }
      });
      break;
      
    case 'navigate':
      // Navigate to the selected domain
      const domain = values.domain;
      const protocol = values.protocol || 'https';
      
      // Get the current tab's path
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs.length > 0) {
          const tab = tabs[0];
          const url = new URL(tab.url);
          const path = url.pathname + url.search + url.hash;
          
          // Build the new URL
          const newUrl = `${protocol}://${domain}${path}`;
          
          // Get settings to determine how to navigate
          chrome.storage.sync.get(['newWindow', 'incognitoMode'], function(settings) {
            if (settings.newWindow) {
              if (settings.incognitoMode) {
                chrome.windows.create({
                  url: newUrl,
                  incognito: true
                });
              } else {
                chrome.tabs.create({ url: newUrl });
              }
            } else {
              chrome.tabs.update(tab.id, { url: newUrl });
            }
            
            sendResponse({ content: 'Navigating...' });
          });
        }
      });
      break;
      
    case 'toggle-auto-redirect':
      // Toggle auto-redirect setting
      const autoRedirect = values.checked === 'true';
      
      chrome.storage.sync.set({ autoRedirect: autoRedirect }, function() {
        // Send empty response as we don't need to update anything
        sendResponse({ content: '' });
      });
      break;
      
    case 'toggle-new-window':
      // Toggle new window setting
      const newWindow = values.checked === 'true';
      
      chrome.storage.sync.set({ newWindow: newWindow }, function() {
        sendResponse({ content: '' });
      });
      break;
      
    case 'toggle-incognito':
      // Toggle incognito setting
      const incognito = values.checked === 'true';
      
      chrome.storage.sync.set({ incognitoMode: incognito }, function() {
        sendResponse({ content: '' });
      });
      break;
      
    case 'copy-path':
      // Send a message to content script to copy path
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs.length > 0) {
          chrome.tabs.sendMessage(
            tabs[0].id, 
            { action: 'copyPath' },
            function(response) {
              sendResponse({ content: 'Path copied!' });
              
              // Reset the button text after 1.5 seconds
              setTimeout(() => {
                chrome.tabs.sendMessage(
                  tabs[0].id,
                  { action: 'resetPathButton' }
                );
              }, 1500);
            }
          );
        }
      });
      break;
      
    case 'copy-url':
      // Send a message to content script to copy URL
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs.length > 0) {
          chrome.tabs.sendMessage(
            tabs[0].id, 
            { action: 'copyUrl' },
            function(response) {
              sendResponse({ content: 'URL copied!' });
              
              // Reset the button text after 1.5 seconds
              setTimeout(() => {
                chrome.tabs.sendMessage(
                  tabs[0].id,
                  { action: 'resetUrlButton' }
                );
              }, 1500);
            }
          );
        }
      });
      break;
      
    default:
      sendResponse({ error: `Unknown endpoint: ${endpoint}` });
  }
}

// Detect environments based on hostname patterns
function detectEnvironments(hostname) {
  const environments = [];
  
  return environments;
}

// Find which project a domain belongs to
function findProjectForDomain(hostname, projects) {
  for (const project of projects) {
    if (project.domains) {
      for (const domainEntry of project.domains) {
        const domain = typeof domainEntry === 'string' ? domainEntry : domainEntry.domain;
        
        // Check for exact match or wildcard match
        if (domain === hostname || matchesDomain(hostname, domain)) {
          return project;
        }
      }
    }
  }
  return null;
}

// Helper function to check if a hostname matches a pattern (with wildcards)
function matchesDomain(hostname, pattern) {
  // If the pattern contains a wildcard
  if (pattern.includes('*')) {
    // Convert the wildcard pattern to a regular expression
    // Escape special regex characters but keep * as wildcard
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
      .replace(/\*/g, '.*'); // Replace * with .*
    
    // Create a regular expression from the pattern
    const regex = new RegExp(`^${regexPattern}$`);
    
    // Test if the hostname matches the pattern
    return regex.test(hostname);
  }
  
  // No wildcard, do a direct comparison
  return hostname === pattern;
} 