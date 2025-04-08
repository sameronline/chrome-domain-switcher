// Environment Detector - Content Script

// Domain detection patterns
const DOMAIN_PATTERNS = {
  // Removed lando, ddev, and browserSync patterns
};

// Class for the floating UI
class EnvSwitcherUI {
  constructor() {
    this.domains = [];
    this.protocolRules = [];
    this.detectors = {}; // Removed lando, ddev, browserSync detectors
    this.showProtocol = true;
    this.autoCollapse = true;
    this.autoRedirect = true;
    this.newWindow = false;
    this.collapsed = false;
    this.enabled = false;
    
    // Current URL info
    this.currentUrl = window.location.href;
    this.currentProtocol = window.location.protocol;
    this.currentHostname = window.location.hostname;
    this.currentPath = window.location.pathname + window.location.search + window.location.hash;
    
    // UI elements
    this.container = null;
    this.contentWrapper = null;
    this.domainSelect = null;
    this.protocolSelect = null;
    this.goButton = null;
    this.toggleButton = null;
    
    // Load settings and initialize if enabled
    this.loadSettings();
  }
  
  // Load settings from storage
  loadSettings() {
    chrome.storage.sync.get({
      domains: [],
      protocolRules: [],
      detectors: {}, // Removed lando, ddev, browserSync detectors
      showProtocol: true,
      autoCollapse: true,
      autoRedirect: true,
      newWindow: false,
      floatingEnabled: false
    }, (items) => {
      this.domains = items.domains;
      this.protocolRules = items.protocolRules;
      this.detectors = items.detectors;
      this.showProtocol = items.showProtocol;
      this.autoCollapse = items.autoCollapse;
      this.autoRedirect = items.autoRedirect;
      this.newWindow = items.newWindow;
      this.enabled = items.floatingEnabled;
      
      // Initialize if enabled
      if (this.enabled) {
        this.initialize();
      }
    });
  }
  
  // Initialize the floating UI
  initialize() {
    // Detect environments
    this.detectEnvironments();
    
    // Build the UI
    this.buildUI();
    
    // Attach event handlers
    this.attachEventHandlers();
    
    // Add to the DOM
    this.appendToDOM();
  }
  
  // Detect environments based on the current hostname
  detectEnvironments() {
    // Initialize detected domains array
    let detectedDomains = [];
    
    // Removed all lando, ddev, browserSync detection code
    
    // Merge detected domains with configured domains
    this.domains = [...new Set([...this.domains, ...detectedDomains])];
  }
  
  // Build the UI elements
  buildUI() {
    // Create the main container
    this.container = document.createElement('div');
    this.container.className = 'env-switcher-floating';
    if (this.collapsed) {
      this.container.classList.add('env-switcher-floating--collapsed');
    }
    
    // Create content wrapper
    this.contentWrapper = document.createElement('div');
    this.contentWrapper.className = 'env-switcher-floating__content';
    
    // Create toggle button
    this.toggleButton = document.createElement('button');
    this.toggleButton.className = 'env-switcher-floating__toggle';
    this.toggleButton.innerHTML = this.collapsed ? '⊕' : '⊖';
    
    // Create protocol select if enabled
    if (this.showProtocol) {
      this.protocolSelect = document.createElement('select');
      this.protocolSelect.className = 'env-switcher-floating__protocol';
      
      const httpsOption = document.createElement('option');
      httpsOption.value = 'https:';
      httpsOption.textContent = 'https://';
      
      const httpOption = document.createElement('option');
      httpOption.value = 'http:';
      httpOption.textContent = 'http://';
      
      this.protocolSelect.appendChild(httpsOption);
      this.protocolSelect.appendChild(httpOption);
      this.protocolSelect.value = this.currentProtocol;
      
      // Check for forced protocol
      const forcedProtocol = this.getForcedProtocol(this.currentHostname);
      if (forcedProtocol) {
        this.protocolSelect.value = forcedProtocol;
        this.protocolSelect.disabled = true;
      }
      
      this.contentWrapper.appendChild(this.protocolSelect);
    }
    
    // Create domain select
    this.domainSelect = document.createElement('select');
    this.domainSelect.className = 'env-switcher-floating__domain';
    
    // Add all domains to select
    this.domains.forEach(domain => {
      const option = document.createElement('option');
      option.value = domain;
      option.textContent = domain;
      option.selected = domain === this.currentHostname;
      this.domainSelect.appendChild(option);
    });
    
    // Add current domain if not in list
    if (this.domains.indexOf(this.currentHostname) === -1) {
      const option = document.createElement('option');
      option.value = this.currentHostname;
      option.textContent = this.currentHostname;
      option.selected = true;
      this.domainSelect.appendChild(option);
    }
    
    this.contentWrapper.appendChild(this.domainSelect);
    
    // Create Go button
    this.goButton = document.createElement('button');
    this.goButton.className = 'env-switcher-floating__go';
    this.goButton.textContent = 'Go';
    
    // Only show if auto-redirect is disabled
    if (this.autoRedirect) {
      this.goButton.style.display = 'none';
    }
    
    this.contentWrapper.appendChild(this.goButton);
    
    // Add elements to container
    this.container.appendChild(this.contentWrapper);
    this.container.appendChild(this.toggleButton);
  }
  
  // Attach event handlers
  attachEventHandlers() {
    // Toggle button handler
    this.toggleButton.addEventListener('click', () => {
      this.collapsed = !this.collapsed;
      
      if (this.collapsed) {
        this.container.classList.add('env-switcher-floating--collapsed');
        this.toggleButton.innerHTML = '⊕';
      } else {
        this.container.classList.remove('env-switcher-floating--collapsed');
        this.toggleButton.innerHTML = '⊖';
      }
      
      // Save collapsed state
      chrome.storage.sync.set({ collapsedState: this.collapsed });
    });
    
    // Domain select handler
    this.domainSelect.addEventListener('change', () => {
      // Update protocol if forced
      const forcedProtocol = this.getForcedProtocol(this.domainSelect.value);
      if (forcedProtocol && this.protocolSelect) {
        this.protocolSelect.value = forcedProtocol;
        this.protocolSelect.disabled = true;
      } else if (this.protocolSelect) {
        this.protocolSelect.disabled = false;
      }
      
      // Auto-redirect if enabled
      if (this.autoRedirect) {
        this.navigateToSelectedUrl();
      }
    });
    
    // Protocol select handler
    if (this.protocolSelect) {
      this.protocolSelect.addEventListener('change', () => {
        // Auto-redirect if enabled
        if (this.autoRedirect) {
          this.navigateToSelectedUrl();
        }
      });
    }
    
    // Go button handler
    this.goButton.addEventListener('click', () => {
      this.navigateToSelectedUrl();
    });
  }
  
  // Navigate to the selected URL
  navigateToSelectedUrl() {
    const selectedDomain = this.domainSelect.value;
    const selectedProtocol = this.protocolSelect ? this.protocolSelect.value : this.currentProtocol;
    
    // Force protocol if needed
    const forcedProtocol = this.getForcedProtocol(selectedDomain);
    const protocol = forcedProtocol || selectedProtocol;
    
    const url = `${protocol}//${selectedDomain}${this.currentPath}`;
    
    if (this.newWindow) {
      window.open(url, '_blank');
    } else {
      window.location.href = url;
    }
    
    // Auto-collapse if enabled
    if (this.autoCollapse) {
      this.collapsed = true;
      this.container.classList.add('env-switcher-floating--collapsed');
      this.toggleButton.innerHTML = '⊕';
      
      // Save collapsed state
      chrome.storage.sync.set({ collapsedState: this.collapsed });
    }
  }
  
  // Check if domain has a forced protocol
  getForcedProtocol(domain) {
    for (const rule of this.protocolRules) {
      if (!rule.includes('|')) continue;
      
      const [pattern, protocol] = rule.split('|');
      const trimmedPattern = pattern.trim();
      const trimmedProtocol = protocol.trim();
      
      if (this.matchesDomainPattern(domain, trimmedPattern)) {
        return trimmedProtocol + ':';
      }
    }
    return null;
  }
  
  // Check if domain matches a pattern
  matchesDomainPattern(domain, pattern) {
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
  
  // Append the UI to the DOM
  appendToDOM() {
    document.body.appendChild(this.container);
  }
  
  // Show the floating UI
  show() {
    this.container.style.display = 'block';
  }
  
  // Hide the floating UI
  hide() {
    this.container.style.display = 'none';
  }
  
  // Toggle the UI visibility
  toggle() {
    if (this.container.style.display === 'none') {
      this.show();
    } else {
      this.hide();
    }
  }
  
  // Destroy the UI
  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

// Initialize a single instance
let envSwitcher = null;

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleFloatingUI') {
    if (message.enabled) {
      // Create the floating UI if it doesn't exist
      if (!envSwitcher) {
        envSwitcher = new EnvSwitcherUI();
      } else {
        envSwitcher.show();
      }
    } else {
      // Hide the floating UI if it exists
      if (envSwitcher) {
        envSwitcher.hide();
      }
    }
    
    sendResponse({ success: true });
  }
});

// Check if floating UI should be enabled on page load
chrome.storage.sync.get({ floatingEnabled: false }, (items) => {
  if (items.floatingEnabled) {
    envSwitcher = new EnvSwitcherUI();
  }
}); 