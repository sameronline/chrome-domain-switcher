// Environment Detector - Content Script (htmx version)

// Import shared functionality or define if not available
const EnvStorage = window.EnvStorage || {
  keys: {
    PROJECTS: 'projects',
    PROTOCOL_RULES: 'protocolRules',
    AUTO_REDIRECT: 'autoRedirect',
    NEW_WINDOW: 'newWindow',
    INCOGNITO_MODE: 'incognitoMode',
    COLLAPSED_STATE: 'collapsedState',
    SHOW_PROTOCOL: 'showProtocol',
    AUTO_COLLAPSE: 'autoCollapse'
  },
  defaults: {
    projects: [
      {
        name: "Example Project",
        domains: [
          { domain: "dev.example.com", label: "Development" },
          { domain: "stage.example.com", label: "Staging" },
          { domain: "www.example.com", label: "Production" }
        ],
        floatingEnabled: false
      }
    ],
    protocolRules: [
      '*.dev.example.com|https',
      '*.stage.example.com|https'
    ],
    autoRedirect: true,
    newWindow: false,
    incognitoMode: false,
    collapsedState: true,
    showProtocol: true,
    autoCollapse: true
  }
};

// Use existing objects from shared.js if available, otherwise define our own
// Protocol related tools
window.ProtocolTools = window.ProtocolTools || {
  // Check if domain has a forced protocol
  getForcedProtocol: function(domain, protocolRules) {
    for (const rule of protocolRules) {
      if (!rule.includes('|')) continue;
      
      const [pattern, protocol] = rule.split('|');
      const trimmedPattern = pattern.trim();
      const trimmedProtocol = protocol.trim();
      
      if (this.matchesDomainPattern(domain, trimmedPattern)) {
        return trimmedProtocol + ':';
      }
    }
    return null;
  },
  
  // Check if domain matches a pattern
  matchesDomainPattern: function(domain, pattern) {
    // Escape regex special chars but keep * as wildcard
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
      .replace(/\*/g, '[^.]+'); // Replace * with regex for "any chars except dot"
    
    try {
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(domain);
    } catch (e) {
      console.error('Invalid regex pattern:', regexPattern, e);
      return false;
    }
  }
};

// URL related tools
window.UrlTools = window.UrlTools || {
  // Build URL with selected domain and protocol
  buildUrl: function(domain, protocol, path, protocolRules) {
    // Force protocol if needed
    const forcedProtocol = window.ProtocolTools.getForcedProtocol(domain, protocolRules);
    const finalProtocol = forcedProtocol || protocol;
    
    return `${finalProtocol}//${domain}${path}`;
  },
  
  // Parse a URL into components
  parseUrl: function(url) {
    try {
      const urlObj = new URL(url);
      return {
        protocol: urlObj.protocol,
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search + urlObj.hash,
        valid: true
      };
    } catch (e) {
      console.error('Error parsing URL:', e);
      return { valid: false };
    }
  }
};

// Project related tools
window.ProjectTools = window.ProjectTools || {
  // Find which project a domain belongs to
  findProjectForDomain: function(hostname, projects) {
    for (const project of projects) {
      if (project.domains) {
        for (const domainEntry of project.domains) {
          // Handle both string domains and domain objects
          const domain = typeof domainEntry === 'string' ? domainEntry : domainEntry.domain;
          
          // Check if domain matches hostname (exact match)
          if (hostname === domain) {
            return project;
          }
          
          // Check for wildcard matches
          if (domain.includes('*')) {
            const regexPattern = domain
              .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
              .replace(/\*/g, '.*'); // Replace * with .*
            
            const regex = new RegExp(`^${regexPattern}$`);
            if (regex.test(hostname)) {
              return project;
            }
          }
        }
      }
    }
    return null;
  }
};

// Initialize EnvSwitcher global object if not already defined
window.EnvSwitcher = window.EnvSwitcher || {
  storage: EnvStorage,
  url: window.UrlTools || {},
  project: window.ProjectTools || {},
  protocol: window.ProtocolTools || {},
  saveSetting: function(key, value, callback) {
    const data = {};
    data[key] = value;
    chrome.storage.sync.set(data, callback || function() {
      console.log(`Saved setting: ${key}`);
    });
  }
};

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
    console.log('Initializing htmx UI...');
    
    // First load htmx
    this.loadHtmxIfNeeded()
      .then(() => {
        console.log('HTMX library loaded successfully, proceeding with template loading');
        
        // Now get the template
        const templateUrl = chrome.runtime.getURL('floating-ui.html');
        console.log('Fetching template from:', templateUrl);
        
        return fetch(templateUrl)
          .then(response => {
            console.log('Template fetch response:', response.status);
            if (!response.ok) {
              throw new Error(`Failed to fetch template: ${response.statusText}`);
            }
            return response.text();
          });
      })
      .then(html => {
        console.log('Template HTML loaded, length:', html.length);
        // Process the template once htmx is loaded
        this.processTemplate(html);
      })
      .catch(error => {
        console.error('Error during initialization:', error);
        console.log('Using fallback template');
        // Use fallback template as a last resort
        const fallbackTemplate = this.getFallbackTemplate();
        this.processTemplate(fallbackTemplate);
      });
  }
  
  // Process the HTML template
  processTemplate(html) {
    console.log('Processing HTML template...');
    
    // Create a temporary div to hold the template
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Extract the template content
    const template = tempDiv.querySelector('#env-switcher-floating-template');
    
    if (!template) {
      console.error('Floating UI template not found in HTML!', html.substring(0, 200) + '...');
      return;
    }
    
    console.log('Template found, creating UI instance');
    
    // Clone the template
    const floatingUI = template.cloneNode(true);
    floatingUI.id = 'env-switcher-floating';
    floatingUI.style.display = 'block';
    
    // Get the actual UI container (not the wrapper)
    this.container = floatingUI.querySelector('.env-switcher-floating');
    
    if (!this.container) {
      console.error('Container element not found in template!');
      return;
    }
    
    console.log('Container element found, setting up UI');
    
    // Ensure htmx is initialized before we use any of its features
    if (!window.htmx) {
      console.error('HTMX not loaded yet but we need to proceed with UI setup');
      // We'll still show the UI but without htmx functionality
    } else {
      console.log('HTMX is available, setting up htmx extension');
      // Make sure the extension is loaded
      this.loadChromeExtension();
    }
    
    // Set collapsed state if needed
    if (this.collapsed) {
      this.container.classList.add('env-switcher-floating--collapsed');
    }
    
    // Populate project select
    const projectSelect = this.container.querySelector('#project-select');
    if (!projectSelect) {
      console.error('Project select element not found!');
      return;
    }
    
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
    const autoRedirectCheckbox = this.container.querySelector('#auto-redirect');
    if (autoRedirectCheckbox) {
      autoRedirectCheckbox.checked = this.autoRedirect;
    }
    
    const newWindowCheckbox = this.container.querySelector('#new-window');
    if (newWindowCheckbox) {
      newWindowCheckbox.checked = this.newWindow;
    }
    
    const incognitoCheckbox = this.container.querySelector('#incognito');
    if (incognitoCheckbox) {
      incognitoCheckbox.checked = this.incognitoMode;
    }
    
    // Show/hide go button based on auto-redirect
    const goButton = this.container.querySelector('#go-button');
    if (goButton) {
      goButton.style.display = this.autoRedirect ? 'none' : 'inline-block';
    }
    
    console.log('Adding UI to DOM...');
    // Append to DOM
    document.body.appendChild(floatingUI);
    console.log('UI added to DOM');
  }
  
  // Get fallback template in case the HTML file can't be loaded
  getFallbackTemplate() {
    return `
    <div id="env-switcher-floating-template" style="display: none;">
      <div class="env-switcher-floating" hx-ext="chrome-ext">
        <button class="env-switcher-floating__toggle"
                hx-post="chrome-ext:/toggle-collapse"
                hx-swap="outerHTML"
                hx-target="closest .env-switcher-floating">−</button>
                
        <div class="env-switcher-floating__content">
          <!-- Row 1: Project select and protocol -->
          <div class="env-switcher-floating__row">
            <select class="env-switcher-floating__select" 
                    id="project-select"
                    hx-post="chrome-ext:/change-project"
                    hx-target="#domain-select-container">
            </select>
            
            <select class="env-switcher-floating__select"
                    id="protocol-select"
                    hx-post="chrome-ext:/update-protocol">
              <option value="http">http</option>
              <option value="https" selected>https</option>
            </select>
          </div>
          
          <!-- Row 2: Domain selection -->
          <div class="env-switcher-floating__row" id="domain-select-container">
            <select class="env-switcher-floating__select domain-select"
                    id="domain-select"
                    hx-post="chrome-ext:/update-domain"
                    hx-trigger="change, load">
            </select>
          </div>
          
          <!-- Row 3: Go button and checkboxes -->
          <div class="env-switcher-floating__row">
            <button class="env-switcher-floating__action-btn"
                    id="go-button"
                    hx-post="chrome-ext:/navigate"
                    hx-include="#domain-select, #protocol-select">Go</button>
            
            <div class="env-switcher-floating__checkbox-container">
              <input type="checkbox" id="auto-redirect" checked 
                     hx-post="chrome-ext:/toggle-auto-redirect"
                     hx-trigger="change">
              <label for="auto-redirect" class="env-switcher-floating__label">Auto</label>
            </div>
            
            <div class="env-switcher-floating__checkbox-container">
              <input type="checkbox" id="new-window"
                     hx-post="chrome-ext:/toggle-new-window"
                     hx-trigger="change">
              <label for="new-window" class="env-switcher-floating__label">New Window</label>
            </div>
            
            <div class="env-switcher-floating__checkbox-container">
              <input type="checkbox" id="incognito"
                     hx-post="chrome-ext:/toggle-incognito"
                     hx-trigger="change">
              <label for="incognito" class="env-switcher-floating__label">Incognito</label>
            </div>
          </div>
          
          <!-- Row 4: Copy path and Copy URL buttons -->
          <div class="env-switcher-floating__row">
            <button class="env-switcher-floating__action-btn"
                    hx-post="chrome-ext:/copy-path">Path</button>
            
            <button class="env-switcher-floating__action-btn"
                    hx-post="chrome-ext:/copy-url">URL</button>
          </div>
        </div>
      </div>
    </div>
    `;
  }
  
  // Load htmx library if not already present
  loadHtmxIfNeeded() {
    return new Promise((resolve, reject) => {
      if (window.htmx) {
        resolve();
        return;
      }
      
      try {
        console.log('Loading htmx from local file...');
        const scriptUrl = chrome.runtime.getURL('htmx.js');
        console.log('Local htmx URL:', scriptUrl);
        
        const script = document.createElement('script');
        script.src = scriptUrl;
        script.onload = () => {
          console.log('htmx loaded successfully from local file');
          resolve();
        };
        script.onerror = (err) => {
          console.error('Failed to load htmx from local file:', err);
          reject(err);
        };
        document.head.appendChild(script);
      } catch (err) {
        console.error('Error setting up htmx:', err);
        reject(err);
      }
    });
  }
  
  // Load the Chrome extension for htmx
  loadChromeExtension() {
    try {
      const scriptUrl = chrome.runtime.getURL('htmx-chrome-ext.js');
      console.log('Loading Chrome extension from:', scriptUrl);
      
      fetch(scriptUrl)
        .then(response => {
          console.log('Extension script response:', response.status);
          return response.text();
        })
        .then(scriptText => {
          if (scriptText && scriptText.length > 0) {
            // Create a script element
            const script = document.createElement('script');
            script.textContent = scriptText;
            document.head.appendChild(script);
            console.log('Chrome extension script injected from file');
          } else {
            this.injectFallbackExtensionCode();
          }
        })
        .catch(error => {
          console.error('Error loading Chrome extension script:', error);
          this.injectFallbackExtensionCode();
        });
    } catch (e) {
      console.error('Error getting extension script URL:', e);
      this.injectFallbackExtensionCode();
    }
  }
  
  // Inject fallback extension code
  injectFallbackExtensionCode() {
    console.log('Injecting fallback extension code');
    const script = document.createElement('script');
    script.textContent = `
    (function() {
      // Register the chrome-ext extension with htmx
      htmx.defineExtension('chrome-ext', {
        onEvent: function(name, evt) {
          // We only want to handle trigger events
          if (name !== 'htmx:beforeRequest') return true;
          
          // Check if the request is directed to our chrome-ext protocol
          const path = evt.detail.path;
          if (!path.startsWith('chrome-ext:/')) return true;
          
          // Prevent the default htmx Ajax request
          evt.preventDefault();
          
          // Extract the endpoint name (removing the protocol prefix)
          const endpoint = path.replace('chrome-ext:/', '');
          
          // Extract values from the triggering element
          const elt = evt.detail.elt;
          const target = htmx.getTarget(elt);
          const headers = evt.detail.headers;
          const values = htmx.values(elt);
          
          // Create a request payload for the background script
          const payload = {
            action: 'htmx',
            endpoint: endpoint,
            values: values,
            headers: headers
          };
          
          // Show the htmx request indicator
          htmx.addClass(elt, htmx.config.requestClass);
          
          // Send message to the background script
          chrome.runtime.sendMessage(payload, function(response) {
            // Remove the htmx request indicator
            htmx.removeClass(elt, htmx.config.requestClass);
            
            // Handle the response
            if (response && response.content) {
              // Process the response as if it were a normal htmx response
              const swapSpec = htmx.getSwapSpecification(elt);
              
              // Perform the content swap
              htmx.swap(target, response.content, swapSpec);
              
              // Trigger the afterRequest event
              htmx.process(target);
              
              // Trigger a custom event so that listeners know the request is complete
              htmx.trigger(elt, 'htmx:afterRequest', {
                path: path,
                success: true,
                requestConfig: evt.detail
              });
            } else if (response && response.error) {
              console.error('Chrome extension htmx error:', response.error);
              
              // Trigger error event
              htmx.trigger(elt, 'htmx:responseError', {
                error: response.error,
                path: path
              });
            }
          });
          
          // Prevent the default htmx handling
          return false;
        }
      });
    })();
    `;
    document.head.appendChild(script);
    console.log('Fallback extension code injected');
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
  
  // Destroy UI
  destroy() {
    if (this.container && this.container.parentElement) {
      this.container.parentElement.remove();
      this.container = null;
    }
  }
}

// Create the UI instance
let envSwitcherUI;

// Initialize when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOMContentLoaded triggered - initializing Environment Switcher UI');
  
  // Check if the floating-ui.html is accessible
  try {
    const resourceUrl = chrome.runtime.getURL('floating-ui.html');
    console.log('Checking resource URL:', resourceUrl);
    
    fetch(resourceUrl)
      .then(response => {
        console.log('Resource fetch response:', response.status, response.ok);
        if (!response.ok) {
          console.error('Failed to fetch floating-ui.html:', response.statusText);
        }
        return response.text();
      })
      .then(text => {
        console.log('Resource content length:', text.length);
        if (text.length > 0) {
          console.log('Resource content sample:', text.substring(0, 100) + '...');
        }
      })
      .catch(err => {
        console.error('Error fetching resource:', err);
      });
  } catch (e) {
    console.error('Error getting resource URL:', e);
  }
  
  // Create the UI instance
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
  
  // Handle copy path
  if (message.action === 'copyPath') {
    const path = window.location.pathname + window.location.search + window.location.hash;
    navigator.clipboard.writeText(path).then(() => {
      if (envSwitcherUI && envSwitcherUI.container) {
        const copyPathButton = envSwitcherUI.container.querySelector('button[hx-post="chrome-ext:/copy-path"]');
        if (copyPathButton) {
          copyPathButton.textContent = 'Copied!';
        }
      }
      sendResponse({ success: true });
    });
    return true;
  }
  
  // Reset path button text
  if (message.action === 'resetPathButton') {
    if (envSwitcherUI && envSwitcherUI.container) {
      const copyPathButton = envSwitcherUI.container.querySelector('button[hx-post="chrome-ext:/copy-path"]');
      if (copyPathButton) {
        copyPathButton.textContent = 'Path';
      }
    }
    return true;
  }
  
  // Handle copy URL
  if (message.action === 'copyUrl') {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      if (envSwitcherUI && envSwitcherUI.container) {
        const copyUrlButton = envSwitcherUI.container.querySelector('button[hx-post="chrome-ext:/copy-url"]');
        if (copyUrlButton) {
          copyUrlButton.textContent = 'Copied!';
        }
      }
      sendResponse({ success: true });
    });
    return true;
  }
  
  // Reset URL button text
  if (message.action === 'resetUrlButton') {
    if (envSwitcherUI && envSwitcherUI.container) {
      const copyUrlButton = envSwitcherUI.container.querySelector('button[hx-post="chrome-ext:/copy-url"]');
      if (copyUrlButton) {
        copyUrlButton.textContent = 'URL';
      }
    }
    return true;
  }
}); 