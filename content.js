// Environment Detector - Content Script

// Add helper function to check if a hostname matches a domain pattern (supporting wildcards)
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

// Class for the floating UI
class EnvSwitcherUI {
  constructor() {
    this.projects = [];
    this.protocolRules = [];
    this.showProtocol = true;
    this.autoCollapse = true;
    this.autoRedirect = true;
    this.newWindow = false;
    this.collapsed = false;
    this.enabled = false;
    this.enforceProtocols = true;
    
    // Current URL info
    const urlInfo = EnvSwitcher.url.parseUrl(window.location.href);
    this.currentUrl = window.location.href;
    this.currentProtocol = window.location.protocol;
    this.currentHostname = window.location.hostname;
    this.currentPath = window.location.pathname + window.location.search + window.location.hash;
    
    // Current project and domains
    this.currentProject = null;
    this.currentProjectDomains = [];
    
    // UI elements
    this.container = null;
    this.contentWrapper = null;
    this.projectSelect = null;
    this.domainSelect = null;
    this.protocolSelect = null;
    this.goButton = null;
    this.toggleButton = null;
    this.copyPathButton = null;
    this.copyUrlButton = null;
    this.autoRedirectCheckbox = null;
    this.newWindowCheckbox = null;
    
    // Load settings and initialize if relevant project is enabled
    this.loadSettings();
  }
  
  // Load settings from storage
  loadSettings() {
    EnvSwitcher.getSettings((items) => {
      this.projects = items.projects;
      this.protocolRules = items.protocolRules;
      this.showProtocol = items.showProtocol;
      this.autoCollapse = items.autoCollapse;
      this.autoRedirect = items.autoRedirect;
      this.newWindow = items.newWindow;
      this.collapsed = items.collapsedState;
      
      // Find the current project
      this.findCurrentProject();
      
      // Initialize if the current project has floating UI enabled
      if (this.currentProject && this.currentProject.floatingEnabled) {
        this.enabled = true;
        this.initialize();
      }
      
      // Debug information to help diagnose the issue
      console.log('Environment Switcher:', {
        currentHostname: this.currentHostname,
        currentProject: this.currentProject ? this.currentProject.name : 'none',
        enabled: this.enabled,
        floatingEnabled: this.currentProject ? this.currentProject.floatingEnabled : undefined,
        projects: this.projects.map(p => ({ name: p.name, domains: p.domains, enabled: p.floatingEnabled }))
      });
    });
  }
  
  // Initialize the floating UI
  initialize() {
    // Build the UI
    this.buildUI();
    
    // Only continue if UI was built successfully
    if (!this.container) {
      return;
    }
    
    // Attach event handlers
    this.addEventListeners();
    
    // Add to the DOM
    this.appendToDOM();
  }
  
  // Find which project the current domain belongs to
  findCurrentProject() {
    if (!this.projects || this.projects.length === 0) {
      console.log('No projects defined');
      return;
    }
    
    for (const project of this.projects) {
      if (project.domains) {
        for (const domainPattern of project.domains) {
          if (matchesDomain(this.currentHostname, domainPattern)) {
            this.currentProject = project;
            this.currentProjectDomains = project.domains;
            return;
          }
        }
      }
    }
    
    console.log('No project found for domain: ' + this.currentHostname);
  }
  
  // Build the UI elements
  buildUI() {
    // Skip building UI if no current project
    if (!this.currentProject) {
      console.log('No project found for domain: ' + this.currentHostname);
      return;
    }
    
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
    this.toggleButton.title = this.collapsed ? 'Expand environment switcher' : 'Collapse environment switcher';
    this.toggleButton.addEventListener('click', () => this.toggleCollapse());
    
    // ROW 1: Project and Protocol selection
    const row1 = document.createElement('div');
    row1.className = 'env-switcher-floating__row';
    
    // Create project select if we have projects
    if (this.projects.length > 0) {
      this.projectSelect = document.createElement('select');
      this.projectSelect.className = 'env-switcher-floating__select';
      this.projectSelect.title = 'Select Project';
      
      // Add all projects to select
      this.projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.name;
        option.textContent = project.name;
        option.selected = this.currentProject && project.name === this.currentProject.name;
        this.projectSelect.appendChild(option);
      });
      
      this.projectSelect.addEventListener('change', () => {
        const selectedProject = this.projects.find(p => p.name === this.projectSelect.value);
        if (selectedProject) {
          this.currentProject = selectedProject;
          this.updateDomainOptions();
        }
      });
      
      row1.appendChild(this.projectSelect);
    }
    
    // Create protocol select if enabled
    if (this.showProtocol) {
      this.protocolSelect = document.createElement('select');
      this.protocolSelect.className = 'env-switcher-floating__select';
      this.protocolSelect.title = 'Select Protocol';
      
      const protocols = ['http', 'https'];
      protocols.forEach(protocol => {
        const option = document.createElement('option');
        option.value = protocol;
        option.textContent = protocol;
        option.selected = protocol === this.currentProtocol;
        this.protocolSelect.appendChild(option);
      });
      
      row1.appendChild(this.protocolSelect);
    }
    
    this.contentWrapper.appendChild(row1);
    
    // ROW 2: Domain selection
    const row2 = document.createElement('div');
    row2.className = 'env-switcher-floating__row';
    
    // Create domain select
    this.domainSelect = document.createElement('select');
    this.domainSelect.className = 'env-switcher-floating__select env-switcher-floating__domain-select';
    this.domainSelect.title = 'Select Domain';
    
    // Add domains for the current project
    this.updateDomainOptions();
    
    row2.appendChild(this.domainSelect);
    this.contentWrapper.appendChild(row2);
    
    // ROW 3: Go button and checkboxes
    const row3 = document.createElement('div');
    row3.className = 'env-switcher-floating__row';
    
    // Create Go button
    this.goButton = document.createElement('button');
    this.goButton.className = 'env-switcher-floating__action-btn';
    this.goButton.textContent = 'Go';
    this.goButton.addEventListener('click', () => this.navigateToSelectedEnvironment());
    
    // Only show if auto-redirect is disabled
    if (this.autoRedirect) {
      this.goButton.style.display = 'none';
    }
    
    row3.appendChild(this.goButton);
    
    // Auto-redirect checkbox
    const autoRedirectContainer = document.createElement('div');
    autoRedirectContainer.className = 'env-switcher-floating__checkbox-container';
    
    const autoRedirectCheckbox = document.createElement('input');
    autoRedirectCheckbox.type = 'checkbox';
    autoRedirectCheckbox.id = 'floating-auto-redirect';
    autoRedirectCheckbox.checked = this.autoRedirect;
    autoRedirectCheckbox.addEventListener('change', () => {
      this.autoRedirect = autoRedirectCheckbox.checked;
      this.goButton.style.display = this.autoRedirect ? 'none' : 'inline-block';
      EnvSwitcher.saveSetting(EnvSwitcher.storage.keys.AUTO_REDIRECT, this.autoRedirect);
    });
    
    const autoRedirectLabel = document.createElement('label');
    autoRedirectLabel.htmlFor = 'floating-auto-redirect';
    autoRedirectLabel.textContent = 'Auto';
    
    autoRedirectContainer.appendChild(autoRedirectCheckbox);
    autoRedirectContainer.appendChild(autoRedirectLabel);
    row3.appendChild(autoRedirectContainer);
    
    // New window checkbox
    const newWindowContainer = document.createElement('div');
    newWindowContainer.className = 'env-switcher-floating__checkbox-container';
    
    const newWindowCheckbox = document.createElement('input');
    newWindowCheckbox.type = 'checkbox';
    newWindowCheckbox.id = 'floating-new-window';
    newWindowCheckbox.checked = this.newWindow;
    newWindowCheckbox.addEventListener('change', () => {
      this.newWindow = newWindowCheckbox.checked;
      EnvSwitcher.saveSetting(EnvSwitcher.storage.keys.NEW_WINDOW, this.newWindow);
    });
    
    const newWindowLabel = document.createElement('label');
    newWindowLabel.htmlFor = 'floating-new-window';
    newWindowLabel.textContent = 'New';
    
    newWindowContainer.appendChild(newWindowCheckbox);
    newWindowContainer.appendChild(newWindowLabel);
    row3.appendChild(newWindowContainer);
    
    this.contentWrapper.appendChild(row3);
    
    // ROW 4: Copy path and Copy URL buttons
    const row4 = document.createElement('div');
    row4.className = 'env-switcher-floating__row';
    
    // Copy path button
    const copyPathButton = document.createElement('button');
    copyPathButton.className = 'env-switcher-floating__action-btn';
    copyPathButton.textContent = 'Path';
    copyPathButton.addEventListener('click', () => {
      const path = window.location.pathname + window.location.search + window.location.hash;
      navigator.clipboard.writeText(path).then(() => {
        copyPathButton.textContent = 'Copied!';
        setTimeout(() => {
          copyPathButton.textContent = 'Path';
        }, 1500);
      });
    });
    row4.appendChild(copyPathButton);
    
    // Copy URL button
    const copyUrlButton = document.createElement('button');
    copyUrlButton.className = 'env-switcher-floating__action-btn';
    copyUrlButton.textContent = 'URL';
    copyUrlButton.addEventListener('click', () => {
      const url = this.buildTargetUrl();
      navigator.clipboard.writeText(url).then(() => {
        copyUrlButton.textContent = 'Copied!';
        setTimeout(() => {
          copyUrlButton.textContent = 'URL';
        }, 1500);
      });
    });
    row4.appendChild(copyUrlButton);
    
    this.contentWrapper.appendChild(row4);
    
    // Add elements to container
    this.container.appendChild(this.toggleButton);
    this.container.appendChild(this.contentWrapper);
    
    // Add to document
    document.body.appendChild(this.container);
    
    // Add event listeners
    this.addEventListeners();
  }
  
  // Update the domain select based on the current project
  updateDomainOptions() {
    // Clear current options
    while (this.domainSelect.firstChild) {
      this.domainSelect.removeChild(this.domainSelect.firstChild);
    }
    
    // Add domain options for current project
    if (this.currentProject) {
      this.currentProject.domains.forEach(domain => {
        const option = document.createElement('option');
        option.value = domain;
        option.textContent = domain;
        option.selected = domain === this.currentHostname;
        this.domainSelect.appendChild(option);
      });
    }

    // Update protocols if necessary
    if (this.protocolSelect && this.enforceProtocols) {
      const forcedProtocol = EnvSwitcher.protocol.getForcedProtocol(this.domainSelect.value, this.protocolRules);
      if (forcedProtocol) {
        this.protocolSelect.value = forcedProtocol.replace(':', '');
        this.protocolSelect.disabled = true;
      } else {
        this.protocolSelect.disabled = false;
      }
    }
  }
  
  // Navigate to the selected URL
  navigateToSelectedEnvironment() {
    const domain = this.domainSelect.value;
    // Make sure protocol is properly formatted (with or without colon)
    const protocol = this.protocolSelect ? this.protocolSelect.value : 'https';
    const protocolWithFormat = protocol.endsWith(':') ? protocol : protocol + ':';
    const path = window.location.pathname + window.location.search + window.location.hash;
    
    // Build the URL using the correct function
    const url = EnvSwitcher.url.buildUrl(
      domain,
      protocolWithFormat,
      path,
      this.protocolRules
    );
    
    console.log('Navigating to URL:', url);
    
    // Navigate to the URL
    if (this.newWindow) {
      window.open(url, '_blank');
    } else {
      window.location.href = url;
    }
  }
  
  // Append the UI to the DOM
  appendToDOM() {
    // Only append if container exists
    if (this.container) {
      // Check if already in DOM to avoid duplicates
      if (!this.container.parentNode) {
        try {
          document.body.appendChild(this.container);
          console.log('Environment Switcher UI appended to DOM');
        } catch (e) {
          console.error('Failed to append Environment Switcher UI to DOM:', e);
        }
      }
    } else {
      console.warn('Cannot append Environment Switcher UI: container not created');
    }
  }
  
  // Show the UI
  show() {
    if (this.container) {
      this.container.style.display = 'flex';
      console.log('Environment Switcher UI shown');
    }
  }
  
  // Hide the UI
  hide() {
    if (this.container) {
      this.container.style.display = 'none';
      console.log('Environment Switcher UI hidden');
    }
  }
  
  // Toggle the UI visibility
  toggle() {
    if (this.container) {
      if (this.container.style.display === 'none') {
        this.show();
      } else {
        this.hide();
      }
    }
  }
  
  // Destroy the UI
  destroy() {
    if (this.container && this.container.parentNode) {
      try {
        this.container.parentNode.removeChild(this.container);
        console.log('Environment Switcher UI removed from DOM');
        this.container = null;
      } catch (e) {
        console.error('Failed to remove Environment Switcher UI from DOM:', e);
      }
    }
  }
  
  // Enable floating UI for a specific project
  enableForProject(projectName) {
    // Find the project by name
    const project = this.projects.find(p => p.name === projectName);
    
    if (project) {
      // Update the project's enabled status in storage
      project.floatingEnabled = true;
      
      // Update current project if it matches
      if (this.currentProject && this.currentProject.name === projectName) {
        this.currentProject.floatingEnabled = true;
        this.enabled = true;
        
        // If UI already exists, show it
        if (this.container) {
          this.show();
        } else {
          // Otherwise initialize it
          this.initialize();
        }
      }
      
      // Save the updated projects to storage
      EnvSwitcher.saveSetting(EnvSwitcher.storage.keys.PROJECTS, this.projects, () => {
        console.log(`Floating UI enabled for project: ${projectName}`);
      });
    } else {
      console.log(`Project not found: ${projectName}`);
    }
  }
  
  // Disable floating UI for a specific project
  disableForProject(projectName) {
    // Find the project by name
    const project = this.projects.find(p => p.name === projectName);
    
    if (project) {
      // Update the project's enabled status in storage
      project.floatingEnabled = false;
      
      // Update current project if it matches
      if (this.currentProject && this.currentProject.name === projectName) {
        this.currentProject.floatingEnabled = false;
        this.enabled = false;
        
        // If UI exists, hide it
        if (this.container) {
          this.hide();
        }
      }
      
      // Save the updated projects to storage
      EnvSwitcher.saveSetting(EnvSwitcher.storage.keys.PROJECTS, this.projects, () => {
        console.log(`Floating UI disabled for project: ${projectName}`);
      });
    } else {
      console.log(`Project not found: ${projectName}`);
    }
  }
  
  // Helper method to show a toast notification
  showToast(message) {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '70px';
    toast.style.right = '20px';
    toast.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    toast.style.color = 'white';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '4px';
    toast.style.zIndex = '1000000';
    toast.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.5s ease';
      
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 500);
    }, 2000);
  }
  
  // Helper method to build URL with current settings
  buildURL() {
    const domain = this.currentHostname;
    const protocol = this.currentProtocol;
    const path = window.location.pathname + window.location.search + window.location.hash;
    
    return EnvSwitcher.url.buildUrl(
      domain,
      protocol,
      path,
      this.protocolRules
    );
  }
  
  // Save settings
  saveSettings() {
    EnvSwitcher.saveSetting(EnvSwitcher.storage.keys.PROJECTS, this.projects);
    EnvSwitcher.saveSetting(EnvSwitcher.storage.keys.PROTOCOL_RULES, this.protocolRules);
    EnvSwitcher.saveSetting(EnvSwitcher.storage.keys.SHOW_PROTOCOL, this.showProtocol);
    EnvSwitcher.saveSetting(EnvSwitcher.storage.keys.AUTO_COLLAPSE, this.autoCollapse);
    EnvSwitcher.saveSetting(EnvSwitcher.storage.keys.AUTO_REDIRECT, this.autoRedirect);
    EnvSwitcher.saveSetting(EnvSwitcher.storage.keys.NEW_WINDOW, this.newWindow);
    EnvSwitcher.saveSetting(EnvSwitcher.storage.keys.COLLAPSED_STATE, this.collapsed);
  }
  
  toggleCollapse() {
    this.collapsed = !this.collapsed;
    this.container.classList.toggle('env-switcher-floating--collapsed');
    this.toggleButton.innerHTML = this.collapsed ? '⊕' : '⊖';
    this.toggleButton.title = this.collapsed ? 'Expand environment switcher' : 'Collapse environment switcher';
    
    // Save collapsed state
    EnvSwitcher.saveSetting(EnvSwitcher.storage.keys.COLLAPSED, this.collapsed);
  }
  
  // Build target URL for links or copying
  buildTargetUrl() {
    const targetDomain = this.domainSelect.value;
    const targetProtocol = this.protocolSelect ? this.protocolSelect.value : window.location.protocol.replace(':', '');
    const protocolWithFormat = targetProtocol.endsWith(':') ? targetProtocol : targetProtocol + ':';
    const currentPath = window.location.pathname + window.location.search + window.location.hash;
    
    return EnvSwitcher.url.buildUrl(
      targetDomain,
      protocolWithFormat,
      currentPath,
      this.protocolRules
    );
  }

  /**
   * Adds event listeners to UI elements
   */
  addEventListeners() {
    // Domain select event listener
    this.domainSelect.addEventListener('change', () => {
      // Update protocol if necessary
      if (this.protocolSelect && this.enforceProtocols) {
        const forcedProtocol = EnvSwitcher.protocol.getForcedProtocol(this.domainSelect.value, this.protocolRules);
        if (forcedProtocol) {
          this.protocolSelect.value = forcedProtocol.replace(':', '');
          this.protocolSelect.disabled = true;
        } else {
          this.protocolSelect.disabled = false;
        }
      }

      // Auto-redirect if enabled
      if (this.autoRedirect) {
        this.navigateToSelectedEnvironment();
      }
    });

    // Protocol select event listener
    if (this.protocolSelect) {
      this.protocolSelect.addEventListener('change', () => {
        this.currentProtocol = this.protocolSelect.value;
        
        // Auto-redirect if enabled
        if (this.autoRedirect) {
          this.navigateToSelectedEnvironment();
        }
      });
    }
  }

  /**
   * Copies the current URL to the clipboard
   */
  copyCurrentUrl() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      this.showFeedbackMessage('URL copied to clipboard!');
    });
  }

  /**
   * Copies the current path to the clipboard
   */
  copyCurrentPath() {
    const path = window.location.pathname + window.location.search + window.location.hash;
    navigator.clipboard.writeText(path).then(() => {
      this.showFeedbackMessage('Path copied to clipboard!');
    });
  }

  /**
   * Shows a feedback message
   * @param {string} message - The message to show
   */
  showFeedbackMessage(message) {
    const feedback = document.createElement('div');
    feedback.className = 'env-switcher-floating__feedback';
    feedback.textContent = message;
    
    this.container.appendChild(feedback);
    
    // Remove after 2 seconds
    setTimeout(() => {
      this.container.removeChild(feedback);
    }, 2000);
  }

  /**
   * Initializes the UI
   */
  init() {
    // Skip if no projects are defined
    if (!this.projects || this.projects.length === 0) {
      return;
    }

    this.buildUI();
    
    // Add event listeners
    this.addEventListeners();
    
    // Add the container to the page
    document.body.appendChild(this.container);
  }
}

// Initialize UI
let envSwitcherUI = null;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleFloatingUI') {
    if (!envSwitcherUI) {
      envSwitcherUI = new EnvSwitcherUI();
    }
    
    // Wait a moment to ensure the UI is properly initialized
    setTimeout(() => {
      if (message.enabled) {
        envSwitcherUI.enableForProject(message.projectName);
      } else {
        envSwitcherUI.disableForProject(message.projectName);
      }
      
      sendResponse({ success: true });
    }, 100);
    
    // Return true to indicate we'll send a response asynchronously
    return true;
  }
});

// Function to ensure the UI is initialized
function initializeUI() {
  if (!envSwitcherUI) {
    console.log('Initializing Environment Switcher UI');
    envSwitcherUI = new EnvSwitcherUI();
  }
}

// Initialize on page load - with both DOMContentLoaded and window load events to ensure it runs
document.addEventListener('DOMContentLoaded', initializeUI);

// Backup initialization in case DOMContentLoaded already fired
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  console.log('Document already loaded, initializing Environment Switcher UI now');
  setTimeout(initializeUI, 100); // Small delay to ensure other scripts have run
} 