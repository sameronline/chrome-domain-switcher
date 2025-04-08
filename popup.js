document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const domainSelect = document.getElementById('domain');
  const protocolSelect = document.getElementById('protocol');
  const goButton = document.getElementById('go-btn');
  const autoRedirectCheckbox = document.getElementById('auto-redirect');
  const newWindowCheckbox = document.getElementById('new-window');
  const copyPathButton = document.getElementById('copy-path');
  const copyUrlButton = document.getElementById('copy-url');
  const configureButton = document.getElementById('configure-btn');
  const toggleFloatingButton = document.getElementById('toggle-floating');
  
  // Current URL info
  let currentUrl, currentProtocol, currentHostname, currentPath;
  
  // User preferences
  let autoRedirect = true;
  let newWindow = false;
  let floatingEnabled = false;
  let domains = [];
  let protocolRules = [];
  
  // Initialize the extension
  function init() {
    chrome.storage.sync.get({
      domains: [],
      protocolRules: [],
      autoRedirect: true,
      newWindow: false,
      floatingEnabled: false
    }, function(items) {
      domains = items.domains;
      protocolRules = items.protocolRules;
      autoRedirect = items.autoRedirect;
      newWindow = items.newWindow;
      floatingEnabled = items.floatingEnabled;
      
      // Update UI based on preferences
      autoRedirectCheckbox.checked = autoRedirect;
      newWindowCheckbox.checked = newWindow;
      
      // Check if Go button should be shown based on auto-redirect
      goButton.style.display = autoRedirect ? 'none' : 'block';
      
      // Get current tab information
      getCurrentTabInfo();
    });
  }
  
  // Get information about the current tab
  function getCurrentTabInfo() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs && tabs.length > 0) {
        const tab = tabs[0];
        const url = new URL(tab.url);
        
        currentUrl = tab.url;
        currentProtocol = url.protocol;
        currentHostname = url.hostname;
        currentPath = url.pathname + url.search + url.hash;
        
        // Update protocol select
        protocolSelect.value = currentProtocol;
        
        // Check for protocol rules
        const forcedProtocol = getForcedProtocol(currentHostname);
        if (forcedProtocol) {
          protocolSelect.value = forcedProtocol;
          protocolSelect.disabled = true;
        } else {
          protocolSelect.disabled = false;
        }
        
        // Populate domain select dropdown
        populateDomains();
      }
    });
  }
  
  // Populate the domain dropdown with available options
  function populateDomains() {
    // Clear existing options
    domainSelect.innerHTML = '';
    
    // Add detected + configured domains
    let allDomains = [...domains];
    
    // Add current domain if not in the list
    if (currentHostname && !allDomains.includes(currentHostname)) {
      allDomains.push(currentHostname);
    }
    
    // Remove duplicates and sort
    allDomains = [...new Set(allDomains)].sort();
    
    // Add options to select
    allDomains.forEach(domain => {
      const option = document.createElement('option');
      option.value = domain;
      option.textContent = domain;
      option.selected = domain === currentHostname;
      domainSelect.appendChild(option);
    });
  }
  
  // Check if domain has a forced protocol
  function getForcedProtocol(domain) {
    for (const rule of protocolRules) {
      if (!rule.includes('|')) continue;
      
      const [pattern, protocol] = rule.split('|');
      const trimmedPattern = pattern.trim();
      const trimmedProtocol = protocol.trim();
      
      if (matchesDomainPattern(domain, trimmedPattern)) {
        return trimmedProtocol + ':';
      }
    }
    return null;
  }
  
  // Check if domain matches a pattern
  function matchesDomainPattern(domain, pattern) {
    // Escape regex special chars but keep * as wildcard
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
      .replace(/\*/g, '[^.]+'); // Replace * with regex for "any chars except dot"
    
    try {
      const regex = new RegExp('^' + regexPattern + '$');
      return regex.test(domain);
    } catch (e) {
      console.error('Invalid pattern:', pattern, e);
      return false;
    }
  }
  
  // Build URL with selected domain and protocol
  function buildTargetUrl() {
    const selectedDomain = domainSelect.value;
    const selectedProtocol = protocolSelect.value;
    
    // Force protocol if needed
    const forcedProtocol = getForcedProtocol(selectedDomain);
    const protocol = forcedProtocol || selectedProtocol;
    
    return `${protocol}//${selectedDomain}${currentPath}`;
  }
  
  // Navigate to the URL
  function navigateToUrl(url) {
    if (newWindow) {
      chrome.tabs.create({ url: url });
    } else {
      chrome.tabs.update({ url: url });
    }
  }
  
  // Copy text to clipboard
  function copyToClipboard(text, button) {
    navigator.clipboard.writeText(text).then(() => {
      const originalText = button.textContent;
      button.innerHTML = '<span class="icon">✓</span> Copied!';
      
      setTimeout(() => {
        button.innerHTML = originalText;
      }, 2000);
    }).catch(err => {
      console.error('Could not copy text: ', err);
    });
  }
  
  // Event: Domain select change
  domainSelect.addEventListener('change', function() {
    // Update protocol according to rules
    const forcedProtocol = getForcedProtocol(this.value);
    if (forcedProtocol) {
      protocolSelect.value = forcedProtocol;
      protocolSelect.disabled = true;
    } else {
      protocolSelect.disabled = false;
    }
    
    // If auto-redirect is enabled, navigate immediately
    if (autoRedirect) {
      navigateToUrl(buildTargetUrl());
    }
  });
  
  // Event: Protocol select change
  protocolSelect.addEventListener('change', function() {
    // If auto-redirect is enabled, navigate immediately
    if (autoRedirect) {
      navigateToUrl(buildTargetUrl());
    }
  });
  
  // Event: Go button click
  goButton.addEventListener('click', function() {
    navigateToUrl(buildTargetUrl());
  });
  
  // Event: Auto-redirect checkbox change
  autoRedirectCheckbox.addEventListener('change', function() {
    autoRedirect = this.checked;
    goButton.style.display = autoRedirect ? 'none' : 'block';
    
    // Save preference
    chrome.storage.sync.set({ autoRedirect: autoRedirect });
  });
  
  // Event: New window checkbox change
  newWindowCheckbox.addEventListener('change', function() {
    newWindow = this.checked;
    
    // Save preference
    chrome.storage.sync.set({ newWindow: newWindow });
  });
  
  // Event: Copy path button click
  copyPathButton.addEventListener('click', function() {
    copyToClipboard(currentPath, this);
  });
  
  // Event: Copy URL button click
  copyUrlButton.addEventListener('click', function() {
    copyToClipboard(buildTargetUrl(), this);
  });
  
  // Event: Configure button click
  configureButton.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });
  
  // Event: Toggle floating UI button click
  toggleFloatingButton.addEventListener('click', function() {
    floatingEnabled = !floatingEnabled;
    
    // Save preference
    chrome.storage.sync.set({ floatingEnabled: floatingEnabled });
    
    // Send message to content script to toggle floating UI
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'toggleFloatingUI',
          enabled: floatingEnabled
        });
      }
    });
    
    // Update button text
    this.textContent = floatingEnabled ? 'Disable Floating UI' : 'Enable Floating UI';
  });
  
  // Initialize the extension
  init();
}); 