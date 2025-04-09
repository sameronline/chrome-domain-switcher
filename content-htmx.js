// Environment Detector - Content Script (htmx version)

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

// Class for the htmx-powered floating UI
class HtmxEnvSwitcherUI {
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
    
    // Container element
    this.container = null;
    
    // Load settings and initialize if relevant project is enabled
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
        
        console.log('Settings loaded:', this.projects);
        
        // Find the current project for this domain
        this.findCurrentProject();
        
        // Initialize the UI if a project is found
        if (this.currentProject && this.currentProject.floatingEnabled) {
          this.enabled = true;
          this.initialize();
        }
      });
    } catch (e) {
      console.error('Error loading settings:', e);
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
  }
  
  // Initialize the floating UI
  initialize() {
    // Load the htmx library if not already loaded
    this.loadHtmxIfNeeded().then(() => {
      // Fetch the HTML template
      fetch(chrome.runtime.getURL('floating-ui.html'))
        .then(response => response.text())
        .then(html => {
          // Create a temporary div to hold the template
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = html;
          
          // Extract the template content
          const template = tempDiv.querySelector('#env-switcher-floating-template');
          
          if (!template) {
            console.error('Floating UI template not found!');
            return;
          }
          
          // Clone the template
          const floatingUI = template.cloneNode(true);
          floatingUI.id = 'env-switcher-floating';
          floatingUI.style.display = 'block';
          
          // Get the actual UI container (not the wrapper)
          this.container = floatingUI.querySelector('.env-switcher-floating');
          
          // Set collapsed state if needed
          if (this.collapsed) {
            this.container.classList.add('env-switcher-floating--collapsed');
          }
          
          // Populate project select
          const projectSelect = this.container.querySelector('#project-select');
          this.projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.name;
            option.text = project.name;
            option.selected = this.currentProject && project.name === this.currentProject.name;
            projectSelect.appendChild(option);
          });
          
          // Populate domain select
          this.updateDomainOptions();
          
          // Set protocol if available
          const protocolSelect = this.container.querySelector('#protocol-select');
          if (protocolSelect) {
            // Remove protocol colon if present
            const currentProtocol = this.currentProtocol.replace(':', '');
            protocolSelect.value = currentProtocol;
            
            // Hide if not needed
            if (!this.showProtocol) {
              protocolSelect.style.display = 'none';
            }
          }
          
          // Set checkbox states
          this.container.querySelector('#auto-redirect').checked = this.autoRedirect;
          this.container.querySelector('#new-window').checked = this.newWindow;
          this.container.querySelector('#incognito').checked = this.incognitoMode;
          
          // Show/hide go button based on auto-redirect
          const goButton = this.container.querySelector('#go-button');
          goButton.style.display = this.autoRedirect ? 'none' : 'inline-block';
          
          // Append to DOM
          document.body.appendChild(floatingUI);
          
          // Load the Chrome-htmx extension
          this.loadChromeExtension();
        })
        .catch(error => {
          console.error('Error loading floating UI template:', error);
        });
    });
  }
  
  // Load htmx library if not already present
  loadHtmxIfNeeded() {
    return new Promise((resolve, reject) => {
      if (window.htmx) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/htmx.org@2.0.4';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  
  // Load the Chrome extension for htmx
  loadChromeExtension() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('htmx-chrome-ext.js');
    document.head.appendChild(script);
  }
  
  // Update domain options (called from background.js)
  updateDomainOptions() {
    if (!this.container) return;
    
    const domainSelect = this.container.querySelector('#domain-select');
    if (!domainSelect) return;
    
    // Clear current options
    while (domainSelect.firstChild) {
      domainSelect.removeChild(domainSelect.firstChild);
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
        
        domainSelect.appendChild(option);
      });
    }
  }
  
  // Show the UI
  show() {
    if (this.container) {
      this.container.style.display = 'flex';
    }
  }
  
  // Hide the UI
  hide() {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }
  
  // Toggle collapse state
  toggleCollapse() {
    if (!this.container) return;
    
    this.collapsed = !this.collapsed;
    
    if (this.collapsed) {
      this.container.classList.add('env-switcher-floating--collapsed');
    } else {
      this.container.classList.remove('env-switcher-floating--collapsed');
    }
    
    // Save collapsed state to storage
    EnvSwitcher.saveSetting(EnvSwitcher.storage.keys.COLLAPSED_STATE, this.collapsed);
    
    // Update toggle button text
    const toggleButton = this.container.querySelector('.env-switcher-floating__toggle');
    if (toggleButton) {
      toggleButton.innerHTML = this.collapsed ? '⊕' : '⊖';
      toggleButton.title = this.collapsed ? 'Expand environment switcher' : 'Collapse environment switcher';
    }
  }
  
  // Destroy UI
  destroy() {
    if (this.container && this.container.parentElement) {
      this.container.parentElement.remove();
      this.container = null;
    }
  }
}

// Initialize EnvSwitcher global object if not already defined
if (typeof EnvSwitcher === 'undefined') {
  window.EnvSwitcher = {
    storage: Storage,
    url: UrlTools,
    project: ProjectTools,
    protocol: ProtocolTools
  };
}

// Create the UI instance
let envSwitcherUI;

// Initialize when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
  envSwitcherUI = new HtmxEnvSwitcherUI();
});

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  // Handle message to toggle floating UI
  if (message.action === 'toggleFloatingUI') {
    const projectName = message.projectName;
    const enabled = message.enabled;
    
    console.log(`Toggling floating UI for project ${projectName}: ${enabled}`);
    
    if (enabled) {
      if (!envSwitcherUI) {
        envSwitcherUI = new HtmxEnvSwitcherUI();
      }
      
      if (envSwitcherUI.container) {
        envSwitcherUI.show();
      } else {
        envSwitcherUI.enableForProject(projectName);
      }
    } else {
      if (envSwitcherUI && envSwitcherUI.container) {
        envSwitcherUI.hide();
      }
    }
    
    sendResponse({ success: true });
    return true;
  }
  
  // Handle htmx requests
  if (message.action === 'htmxResponse') {
    // This is handled by the htmx-chrome-ext.js extension
    return true;
  }
}); 