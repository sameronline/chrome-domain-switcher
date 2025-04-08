// Environment Detector - Content Script

// Domain detection patterns
const DOMAIN_PATTERNS = {
  // Removed lando, ddev, and browserSync patterns
};

// Class for the floating UI
class EnvSwitcherUI {
  constructor() {
    this.projects = [];
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
    
    // Load settings and initialize if relevant project is enabled
    this.loadSettings();
  }
  
  // Load settings from storage
  loadSettings() {
    chrome.storage.sync.get({
      projects: [],
      protocolRules: [],
      detectors: {}, // Removed lando, ddev, browserSync detectors
      showProtocol: true,
      autoCollapse: true,
      autoRedirect: true,
      newWindow: false,
      collapsedState: true
    }, (items) => {
      this.projects = items.projects;
      this.protocolRules = items.protocolRules;
      this.detectors = items.detectors;
      this.showProtocol = items.showProtocol;
      this.autoCollapse = items.autoCollapse;
      this.autoRedirect = items.autoRedirect;
      this.newWindow = items.newWindow;
      this.collapsed = items.collapsedState;
      
      // Find the current project
      this.findCurrentProject();
      
      // Initialize if the current project has floating UI enabled
      if (this.currentProject && this.currentProject.floatingEnabled === true) {
        this.enabled = true;
        this.initialize();
      }
    });
  }
  
  // Initialize the floating UI
  initialize() {
    // Build the UI
    this.buildUI();
    
    // Attach event handlers
    this.attachEventHandlers();
    
    // Add to the DOM
    this.appendToDOM();
  }
  
  // Find which project the current domain belongs to
  findCurrentProject() {
    this.currentProject = null;
    
    for (const project of this.projects) {
      if (project.domains.includes(this.currentHostname)) {
        this.currentProject = project;
        this.currentProjectDomains = project.domains;
        break;
      }
    }
    
    // If no project found but projects exist, use the first one
    if (!this.currentProject && this.projects.length > 0) {
      this.currentProject = this.projects[0];
      this.currentProjectDomains = this.projects[0].domains;
    }
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
    
    // Create project select if we have projects
    if (this.projects.length > 0) {
      this.projectSelect = document.createElement('select');
      this.projectSelect.className = 'env-switcher-floating__project';
      
      // Add all projects to select
      this.projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.name;
        option.textContent = project.name;
        option.selected = this.currentProject && project.name === this.currentProject.name;
        this.projectSelect.appendChild(option);
      });
      
      this.contentWrapper.appendChild(this.projectSelect);
    }
    
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
    
    // If we have a current project, use its domains
    if (this.currentProject) {
      // Add domains from current project
      this.currentProject.domains.forEach(domain => {
        const option = document.createElement('option');
        option.value = domain;
        option.textContent = domain;
        option.selected = domain === this.currentHostname;
        this.domainSelect.appendChild(option);
      });
      
      // Add current domain if not in the project
      if (!this.currentProject.domains.includes(this.currentHostname)) {
        const option = document.createElement('option');
        option.value = this.currentHostname;
        option.textContent = this.currentHostname + ' (current)';
        option.selected = true;
        this.domainSelect.appendChild(option);
      }
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
    
    // Project select handler (if exists)
    if (this.projectSelect) {
      this.projectSelect.addEventListener('change', () => {
        const selectedProjectName = this.projectSelect.value;
        const selectedProject = this.projects.find(p => p.name === selectedProjectName);
        
        if (selectedProject) {
          this.currentProject = selectedProject;
          this.updateDomainSelect();
        }
      });
    }
    
    // Domain select handler
    this.domainSelect.addEventListener('change', () => {
      // Update protocol if forced
      const forcedProtocol = this.getForcedProtocol(this.domainSelect.value);
      if (forcedProtocol) {
        this.protocolSelect.value = forcedProtocol;
        this.protocolSelect.disabled = true;
      } else if (this.protocolSelect) {
        this.protocolSelect.disabled = false;
      }
      
      // Navigate if auto-redirect is enabled
      if (this.autoRedirect) {
        this.navigateToSelectedUrl();
      }
      
      // Auto-collapse after selection if enabled
      if (this.autoCollapse) {
        this.collapsed = true;
        this.container.classList.add('env-switcher-floating--collapsed');
        this.toggleButton.innerHTML = '⊕';
      }
    });
    
    // Protocol select handler
    if (this.protocolSelect) {
      this.protocolSelect.addEventListener('change', () => {
        // Navigate if auto-redirect is enabled
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
  
  // Update the domain select based on the current project
  updateDomainSelect() {
    // Clear existing options
    this.domainSelect.innerHTML = '';
    
    // Add domains from current project
    this.currentProject.domains.forEach(domain => {
      const option = document.createElement('option');
      option.value = domain;
      option.textContent = domain;
      this.domainSelect.appendChild(option);
    });
    
    // Select first domain
    if (this.currentProject.domains.length > 0) {
      this.domainSelect.value = this.currentProject.domains[0];
      
      // Update protocol if forced
      const forcedProtocol = this.getForcedProtocol(this.domainSelect.value);
      if (forcedProtocol && this.protocolSelect) {
        this.protocolSelect.value = forcedProtocol;
        this.protocolSelect.disabled = true;
      } else if (this.protocolSelect) {
        this.protocolSelect.disabled = false;
      }
      
      // Navigate if auto-redirect is enabled
      if (this.autoRedirect) {
        this.navigateToSelectedUrl();
      }
    }
  }
  
  // Navigate to the selected URL
  navigateToSelectedUrl() {
    const selectedDomain = this.domainSelect.value;
    const selectedProtocol = this.protocolSelect ? this.protocolSelect.value : window.location.protocol;
    
    // Force protocol if needed
    const forcedProtocol = this.getForcedProtocol(selectedDomain);
    const protocol = forcedProtocol || selectedProtocol;
    
    const targetUrl = `${protocol}//${selectedDomain}${this.currentPath}`;
    
    // Navigate to the new URL
    if (this.newWindow) {
      window.open(targetUrl, '_blank');
    } else {
      window.location.href = targetUrl;
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
  
  // Show the UI
  show() {
    this.container.style.display = 'block';
  }
  
  // Hide the UI
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
  
  // Enable floating UI for a specific project
  enableForProject(projectName) {
    // Update the project's enabled status
    if (this.currentProject && this.currentProject.name === projectName) {
      this.enabled = true;
      
      // If UI already exists, show it
      if (this.container) {
        this.show();
      } else {
        // Otherwise initialize it
        this.initialize();
      }
    }
  }
  
  // Disable floating UI for a specific project
  disableForProject(projectName) {
    // Update the project's enabled status
    if (this.currentProject && this.currentProject.name === projectName) {
      this.enabled = false;
      
      // If UI exists, hide it
      if (this.container) {
        this.hide();
      }
    }
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
    
    if (message.enabled) {
      envSwitcherUI.enableForProject(message.projectName);
    } else {
      envSwitcherUI.disableForProject(message.projectName);
    }
    
    sendResponse({ success: true });
  }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Create the UI instance - it will check if it should be displayed
  envSwitcherUI = new EnvSwitcherUI();
}); 