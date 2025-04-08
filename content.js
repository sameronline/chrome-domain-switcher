// Environment Detector - Content Script

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
    this.attachEventHandlers();
    
    // Add to the DOM
    this.appendToDOM();
  }
  
  // Find which project the current domain belongs to
  findCurrentProject() {
    this.currentProject = EnvSwitcher.project.findProjectForDomain(this.currentHostname, this.projects);
    
    if (this.currentProject) {
      this.currentProjectDomains = this.currentProject.domains;
    }
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
      const forcedProtocol = EnvSwitcher.protocol.getForcedProtocol(this.currentHostname, this.protocolRules);
      if (forcedProtocol) {
        this.protocolSelect.value = forcedProtocol;
        this.protocolSelect.disabled = true;
      }
      
      this.contentWrapper.appendChild(this.protocolSelect);
    }
    
    // Create domain select
    this.domainSelect = document.createElement('select');
    this.domainSelect.className = 'env-switcher-floating__domain';
    
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
    
    // Add elements to container - toggle button first for better clickability
    this.container.appendChild(this.toggleButton);
    this.container.appendChild(this.contentWrapper);
  }
  
  // Attach event handlers
  attachEventHandlers() {
    // Toggle button handler
    this.toggleButton.addEventListener('click', () => {
      this.collapsed = !this.collapsed;
      
      if (this.collapsed) {
        this.container.classList.add('env-switcher-floating--collapsed');
        this.toggleButton.innerHTML = '⊕';
        this.toggleButton.title = 'Expand environment switcher';
      } else {
        this.container.classList.remove('env-switcher-floating--collapsed');
        this.toggleButton.innerHTML = '⊖';
        this.toggleButton.title = 'Collapse environment switcher';
      }
      
      // Save collapsed state
      EnvSwitcher.saveSetting(EnvSwitcher.storage.keys.COLLAPSED_STATE, this.collapsed);
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
      const forcedProtocol = EnvSwitcher.protocol.getForcedProtocol(this.domainSelect.value, this.protocolRules);
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
      const forcedProtocol = EnvSwitcher.protocol.getForcedProtocol(this.domainSelect.value, this.protocolRules);
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
    const url = EnvSwitcher.url.buildUrl(
      this.domainSelect.value,
      this.protocolSelect ? this.protocolSelect.value : window.location.protocol,
      this.currentPath,
      this.protocolRules
    );
    
    // Navigate to the new URL
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