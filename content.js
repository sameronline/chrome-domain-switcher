(function() {
  'use strict';
  
// Get the EnvSwitcher from the namespace
const EnvSwitcher = window.EnvSwitcherNamespace.EnvSwitcher;

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
    this.incognitoMode = false;
    
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
    this.toolsContainer = null;
    
    // Load settings and initialize only if relevant project is enabled
    this.loadSettings();
  }
  
  // Load settings from storage
  loadSettings() {
    try {
      // Get settings from storage
      chrome.storage.sync.get({
        [EnvSwitcher.storage.keys.PROJECTS]: EnvSwitcher.storage.defaults.projects,
        [EnvSwitcher.storage.keys.PROTOCOL_RULES]: EnvSwitcher.storage.defaults.protocolRules,
        [EnvSwitcher.storage.keys.AUTO_REDIRECT]: EnvSwitcher.storage.defaults.autoRedirect,
        [EnvSwitcher.storage.keys.NEW_WINDOW]: EnvSwitcher.storage.defaults.newWindow,
        [EnvSwitcher.storage.keys.INCOGNITO_MODE]: EnvSwitcher.storage.defaults.incognitoMode,
        [EnvSwitcher.storage.keys.SHOW_PROTOCOL]: EnvSwitcher.storage.defaults.showProtocol,
        [EnvSwitcher.storage.keys.AUTO_COLLAPSE]: EnvSwitcher.storage.defaults.autoCollapse,
        [EnvSwitcher.storage.keys.COLLAPSED_STATE]: EnvSwitcher.storage.defaults.collapsedState
      }, (result) => {
        this.projects = result[EnvSwitcher.storage.keys.PROJECTS];
        this.protocolRules = result[EnvSwitcher.storage.keys.PROTOCOL_RULES];
        this.autoRedirect = result[EnvSwitcher.storage.keys.AUTO_REDIRECT];
        this.newWindow = result[EnvSwitcher.storage.keys.NEW_WINDOW];
        this.incognitoMode = result[EnvSwitcher.storage.keys.INCOGNITO_MODE];
        this.showProtocol = result[EnvSwitcher.storage.keys.SHOW_PROTOCOL];
        this.autoCollapse = result[EnvSwitcher.storage.keys.AUTO_COLLAPSE];
        this.collapsed = result[EnvSwitcher.storage.keys.COLLAPSED_STATE];
        
        // Ensure all projects have a tools property
        this.projects.forEach(project => {
          if (!project.tools) {
            project.tools = [];
          }
        });
        
        console.log('Settings loaded:', this.projects);
        
        // Find the current project for this domain
        this.findCurrentProject();
        
        // Initialize the UI if a project is found AND floating UI is enabled for that project
        // Only add elements to the DOM if the project exists and has floatingEnabled set to true
        if (this.currentProject && this.currentProject.floatingEnabled === true) {
          this.enabled = true;
          this.initialize();
        } else {
          console.log('Floating UI not enabled for this project or no matching project found.');
        }
      });
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  }
  
  // Initialize the floating UI
  async initialize() {
    // Load the CSS dynamically only when needed
    try {
      await this.loadFloatingUiCSS();
      
      // Build the UI
      this.buildUI();
      
      // Only continue if UI was built successfully
      if (!this.container) {
        return;
      }
      
      // Add to the DOM
      this.appendToDOM();
    } catch (error) {
      console.error('Failed to initialize floating UI:', error);
    }
  }
  
  // Dynamically load the floating UI CSS
  loadFloatingUiCSS() {
    // Check if the stylesheet is already loaded
    if (document.querySelector('link[href*="floating-ui.css"]')) {
      return;
    }
    
    // Create link element
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.id = 'env-switcher-floating-ui-css';
    link.href = chrome.runtime.getURL('floating-ui.css');
    
    // Create a promise to ensure CSS is loaded
    return new Promise((resolve, reject) => {
      link.onload = resolve;
      link.onerror = reject;
      document.head.appendChild(link);
      console.log('Loading floating UI CSS dynamically');
    }).catch(error => {
      console.error('Failed to load floating UI CSS:', error);
    });
  }
  
  // Remove the floating UI CSS
  removeFloatingUiCSS() {
    const cssLink = document.querySelector('link[href*="floating-ui.css"]');
    if (cssLink && cssLink.parentNode) {
      cssLink.parentNode.removeChild(cssLink);
      console.log('Removed floating UI CSS');
    }
  }
  
  // Find which project the current domain belongs to
  findCurrentProject() {
    if (!this.projects || this.projects.length === 0) {
      console.log('No projects defined');
      return;
    }

    // First, check for exact domain matches
    for (const project of this.projects) {
      if (project.domains) {
        for (const domainEntry of project.domains) {
          const domain = typeof domainEntry === 'string' ? domainEntry : domainEntry.domain;
          
          // Only check for exact (non-wildcard) matches first
          if (!domain.includes('*') && domain === this.currentHostname) {
            this.currentProject = project;
            this.currentProjectDomains = project.domains;
            return;
          }
        }
      }
    }
    
    // If no exact match, check for wildcard matches
    for (const project of this.projects) {
      if (project.domains) {
        for (const domainEntry of project.domains) {
          const domain = typeof domainEntry === 'string' ? domainEntry : domainEntry.domain;
          
          // Only check wildcard domains now
          if (!domain.includes('*')) {
            continue;
          }
          
          if (matchesDomain(this.currentHostname, domain)) {
            // Found a wildcard match
            this.currentProject = project;
            this.currentProjectDomains = project.domains;
            
            // Extract wildcard portion from domain for the label
            function extractWildcardPortion(fullDomain, wildcardPattern) {
              // If pattern is *-something.com, extract the part that matches *
              if (wildcardPattern.startsWith('*')) {
                const suffix = wildcardPattern.substring(1); // Remove the '*'
                if (fullDomain.endsWith(suffix)) {
                  return fullDomain.substring(0, fullDomain.length - suffix.length);
                }
              }
              // For other patterns, fall back to the full domain
              return fullDomain;
            }
            
            // Extract the portion that matches the wildcard
            const wildcardPortion = extractWildcardPortion(this.currentHostname, domain);
            
            // Add the current domain to the domains list with extracted portion as label
            const newDomainEntry = {
              domain: this.currentHostname,
              label: wildcardPortion
            };
            
            // Check if domain is already in the list
            const domainExists = project.domains.some(entry => {
              const entryDomain = typeof entry === 'string' ? entry : entry.domain;
              return entryDomain === this.currentHostname;
            });
            
            if (!domainExists) {
              // Add to the project domains list
              project.domains.push(newDomainEntry);
              
              // Save the updated project to storage
              EnvSwitcher.saveSetting(EnvSwitcher.storage.keys.PROJECTS, this.projects, () => {
                console.log(`Added domain ${this.currentHostname} to project ${project.name} with label ${wildcardPortion}`);
              });
            }
            
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
    
    // ROW 1: Project dropdown and protocol select
    const row1 = document.createElement('div');
    row1.className = 'env-switcher-floating__row';
    
    // Create project dropdown
    this.projectSelect = document.createElement('select');
    this.projectSelect.className = 'env-switcher-floating__select';
    this.projectSelect.title = 'Select Project';
    this.projectSelect.disabled = true; // Disable the project select for visual confirmation only
    
    // Add options for each project
    this.projects.forEach(project => {
      const option = document.createElement('option');
      option.value = project.name;
      option.text = project.name;
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
    autoRedirectLabel.textContent = 'Auto redirect';
    autoRedirectLabel.className = 'env-switcher-floating__label';
    
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
    newWindowLabel.textContent = 'New Window';
    newWindowLabel.className = 'env-switcher-floating__label';
    
    newWindowContainer.appendChild(newWindowCheckbox);
    newWindowContainer.appendChild(newWindowLabel);
    row3.appendChild(newWindowContainer);
    
    // Incognito checkbox
    const incognitoContainer = document.createElement('div');
    incognitoContainer.className = 'env-switcher-floating__checkbox-container';
    
    const incognitoCheckbox = document.createElement('input');
    incognitoCheckbox.type = 'checkbox';
    incognitoCheckbox.id = 'floating-incognito';
    incognitoCheckbox.checked = this.incognitoMode;
    incognitoCheckbox.addEventListener('change', () => {
      this.incognitoMode = incognitoCheckbox.checked;
      EnvSwitcher.saveSetting(EnvSwitcher.storage.keys.INCOGNITO_MODE, this.incognitoMode);
    });
    
    const incognitoLabel = document.createElement('label');
    incognitoLabel.htmlFor = 'floating-incognito';
    incognitoLabel.textContent = 'Incognito';
    incognitoLabel.className = 'env-switcher-floating__label';
    
    incognitoContainer.appendChild(incognitoCheckbox);
    incognitoContainer.appendChild(incognitoLabel);
    row3.appendChild(incognitoContainer);
    
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
    
    // ROW 5: Tools row (if project has tools)
    if (this.currentProject.tools && this.currentProject.tools.length > 0) {
      // Create container for tools
      this.toolsContainer = document.createElement('div');
      this.toolsContainer.className = 'env-switcher-floating__tools';
      
      // Add separator
      const separator = document.createElement('hr');
      separator.className = 'env-switcher-floating__separator';
      this.toolsContainer.appendChild(separator);
      
      // Create tools grid
      const toolsGrid = document.createElement('div');
      toolsGrid.className = 'env-switcher-floating__tools-grid';
      
      // Add each tool
      this.currentProject.tools.forEach(tool => {
        const toolButton = document.createElement('a');
        toolButton.className = 'env-switcher-floating__tool-btn';
        toolButton.href = tool.url;
        toolButton.target = '_blank';
        toolButton.title = tool.label;
        
        // Create icon element
        const icon = document.createElement('img');
        icon.className = 'env-switcher-floating__tool-icon';
        icon.alt = tool.label;
        icon.width = 16;
        icon.height = 16;
        
        // Try to get favicon for the domain
        const domain = this.extractDomainFromUrl(tool.url);
        icon.src = `https://${domain}/favicon.ico`;
        
        // Add fallback in case favicon doesn't load
        icon.onerror = () => {
          // Try alternative favicon locations
          icon.src = `https://${domain}/favicon.png`;
          
          icon.onerror = () => {
            // If all favicon attempts fail, show a generic icon
            icon.src = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjEwIj48L2NpcmNsZT48bGluZSB4MT0iMTIiIHkxPSI4IiB4Mj0iMTIiIHkyPSIxNiI+PC9saW5lPjxsaW5lIHgxPSI4IiB5MT0iMTIiIHgyPSIxNiIgeTI9IjEyIj48L2xpbmU+PC9zdmc+`;
            icon.style.filter = 'invert(0.5)';
          };
        };
        
        toolButton.appendChild(icon);
        
        toolsGrid.appendChild(toolButton);
      });
      
      this.toolsContainer.appendChild(toolsGrid);
      this.contentWrapper.appendChild(this.toolsContainer);
    }
    
    // Add content to container
    this.container.appendChild(this.toggleButton);
    this.container.appendChild(this.contentWrapper);
    
    // Add event listeners
    this.addEventListeners();
    
    // Add to document body
    this.appendToDOM();
  }
  
  // Update the domain select based on the current project
  updateDomainOptions() {
    // Clear current options
    while (this.domainSelect.firstChild) {
      this.domainSelect.removeChild(this.domainSelect.firstChild);
    }
    
    // Add domain options for current project
    if (this.currentProject) {
      this.currentProject.domains.forEach(domainEntry => {
        const option = document.createElement('option');
        
        // Handle both string domains and domain objects with labels
        if (typeof domainEntry === 'string') {
          option.value = domainEntry;
          option.textContent = domainEntry;
          option.selected = domainEntry === this.currentHostname;
        } else {
          option.value = domainEntry.domain;
          option.textContent = domainEntry.label || domainEntry.domain;
          option.selected = domainEntry.domain === this.currentHostname;
        }
        
        this.domainSelect.appendChild(option);
      });
    }

    // Update protocols if necessary
    if (this.protocolSelect && this.enforceProtocols) {
      const domainValue = this.domainSelect.value;
      const forcedProtocol = EnvSwitcher.protocol.getForcedProtocol(domainValue, this.protocolRules);
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
      if (this.incognitoMode) {
        // Create an incognito window (requires background script to handle)
        chrome.runtime.sendMessage({
          action: 'openIncognito',
          url: url
        });
      } else {
        window.open(url, '_blank');
      }
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
  
  /**
   * Removes the floating UI from the DOM
   */
  destroy() {
    if (this.container && this.container.parentNode) {
      // Remove event listeners to prevent memory leaks
      if (this.toggleButton) {
        this.toggleButton.removeEventListener('click', this.toggleCollapse.bind(this));
      }
      
      if (this.goButton) {
        this.goButton.removeEventListener('click', this.navigateToSelectedEnvironment.bind(this));
      }
      
      if (this.projectSelect) {
        this.projectSelect.removeEventListener('change', () => {});
      }
      
      if (this.domainSelect) {
        this.domainSelect.removeEventListener('change', () => {});
      }
      
      // Remove the element from DOM
      this.container.parentNode.removeChild(this.container);
      
      // Remove the CSS as well
      this.removeFloatingUiCSS();
      
      // Reset all UI element references
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
      this.toolsContainer = null;
      
      console.log('Environment Switcher UI destroyed');
    }
  }
  
  // Enable floating UI for a specific project
  async enableForProject(projectName) {
    console.log(`Enabling floating UI for project: ${projectName}`);
    
    // Find the project
    const project = this.projects.find(p => p.name === projectName);
    
    if (!project) {
      console.log(`Project ${projectName} not found`);
      return;
    }
    
    // Update project setting
    project.floatingEnabled = true;
    
    // If this is the current project and UI doesn't exist, initialize it
    if (this.currentProject && this.currentProject.name === projectName) {
      // Only create and add UI elements if they don't already exist
      if (!this.container) {
        this.enabled = true;
        await this.initialize();
      } else {
        // If UI exists but is hidden, show it
        this.show();
      }
    }
    
    // Save setting
    EnvSwitcher.saveSetting(EnvSwitcher.storage.keys.PROJECTS, this.projects);
  }
  
  // Disable floating UI for a specific project
  disableForProject(projectName) {
    console.log(`Disabling floating UI for project: ${projectName}`);
    
    // Find the project
    const project = this.projects.find(p => p.name === projectName);
    
    if (!project) {
      console.log(`Project ${projectName} not found`);
      return;
    }
    
    // Update project setting
    project.floatingEnabled = false;
    
    // If this is the current project, remove UI
    if (this.currentProject && this.currentProject.name === projectName) {
      this.enabled = false;
      this.destroy();
    }
    
    // Save setting
    EnvSwitcher.saveSetting(EnvSwitcher.storage.keys.PROJECTS, this.projects);
  }
  
  // Helper method to show a toast notification
  showToast(message) {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'env-switcher-floating-toast';
    toast.textContent = message;
    
    // Append to document
    document.body.appendChild(toast);
    
    // Set timeout to remove
    setTimeout(() => {
      toast.classList.add('env-switcher-floating-toast--fade-out');
      setTimeout(() => {
        if (toast.parentNode) {
          document.body.removeChild(toast);
        }
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
    EnvSwitcher.saveSetting(EnvSwitcher.storage.keys.INCOGNITO_MODE, this.incognitoMode);
    EnvSwitcher.saveSetting(EnvSwitcher.storage.keys.COLLAPSED_STATE, this.collapsed);
  }
  
  toggleCollapse() {
    this.collapsed = !this.collapsed;
    this.container.classList.toggle('env-switcher-floating--collapsed');
    this.toggleButton.innerHTML = this.collapsed ? '⊕' : '⊖';
    this.toggleButton.title = this.collapsed ? 'Expand environment switcher' : 'Collapse environment switcher';
    
    // Save collapsed state with the correct key
    EnvSwitcher.saveSetting(EnvSwitcher.storage.keys.COLLAPSED_STATE, this.collapsed);
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
      feedback.classList.add('env-switcher-floating__feedback--fade-out');
      setTimeout(() => {
        if (feedback.parentNode) {
          this.container.removeChild(feedback);
        }
      }, 500);
    }, 1500);
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

  // Extract domain from URL
  extractDomainFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (e) {
      console.error('Error extracting domain from URL:', e);
      return '';
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
    
    // Handle async operation
    (async () => {
      try {
        if (message.enabled) {
          await envSwitcherUI.enableForProject(message.projectName);
        } else {
          envSwitcherUI.disableForProject(message.projectName);
        }
        
        sendResponse({ success: true });
      } catch (error) {
        console.error('Error toggling floating UI:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    // Return true to indicate we'll send a response asynchronously
    return true;
  }
});

// Function to ensure the UI is initialized only when needed
function initializeUI() {
  if (!envSwitcherUI) {
    console.log('Initializing Environment Switcher UI');
    envSwitcherUI = new EnvSwitcherUI();
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializeUI);

// Backup initialization in case DOMContentLoaded already fired
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  console.log('Document already loaded, initializing Environment Switcher UI now');
  setTimeout(initializeUI, 100); // Small delay to ensure other scripts have run
}

})(); // End of IIFE 