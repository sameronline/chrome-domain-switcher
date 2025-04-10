// shared.js - Common functionality for Environment Switcher

// Storage module
const Storage = {
  keys: {
    PROJECTS: 'projects',
    PROTOCOL_RULES: 'protocolRules',
    AUTO_REDIRECT: 'autoRedirect',
    NEW_WINDOW: 'newWindow',
    INCOGNITO_MODE: 'incognitoMode',
    COLLAPSED_STATE: 'collapsedState',
    SHOW_PROTOCOL: 'showProtocol',
    AUTO_COLLAPSE: 'autoCollapse',
    TOOLS: 'tools'
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
        floatingEnabled: false,
        tools: []
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
  },
  
  // Get all settings from storage
  getSettings: function(callback) {
    chrome.storage.sync.get({
      [this.keys.PROJECTS]: this.defaults.projects,
      [this.keys.PROTOCOL_RULES]: this.defaults.protocolRules,
      [this.keys.AUTO_REDIRECT]: this.defaults.autoRedirect,
      [this.keys.NEW_WINDOW]: this.defaults.newWindow,
      [this.keys.INCOGNITO_MODE]: this.defaults.incognitoMode,
      [this.keys.COLLAPSED_STATE]: this.defaults.collapsedState,
      [this.keys.SHOW_PROTOCOL]: this.defaults.showProtocol,
      [this.keys.AUTO_COLLAPSE]: this.defaults.autoCollapse
    }, callback);
  },
  
  // Save individual settings
  saveSetting: function(key, value, callback) {
    const data = {};
    data[key] = value;
    chrome.storage.sync.set(data, callback || function() {
      console.log(`Saved setting: ${key}`);
    });
  },
  
  // Save multiple settings at once
  saveSettings: function(settings, callback) {
    chrome.storage.sync.set(settings, callback || function() {
      console.log('Saved multiple settings');
    });
  }
};

// URL module
const UrlTools = {
  // Build URL with selected domain and protocol
  buildUrl: function(domain, protocol, path, protocolRules) {
    // Force protocol if needed
    const forcedProtocol = ProtocolTools.getForcedProtocol(domain, protocolRules);
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
  },
  
  // Navigate to a URL
  navigate: function(url, newWindow) {
    if (newWindow) {
      chrome.tabs.create({ url: url });
    } else {
      chrome.tabs.update({ url: url });
    }
  }
};

// Project module
const ProjectTools = {
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
  },
  
  // Update a project's floating UI status
  updateFloatingUIStatus: function(projectName, projects, enabled, callback) {
    // Find the project index
    const projectIndex = projects.findIndex(p => p.name === projectName);
    
    if (projectIndex !== -1) {
      // Create a new projects array with the updated project
      const updatedProjects = [...projects];
      updatedProjects[projectIndex] = {
        ...updatedProjects[projectIndex],
        floatingEnabled: enabled
      };
      
      // Save the updated projects
      Storage.saveSetting(Storage.keys.PROJECTS, updatedProjects, callback);
      
      return updatedProjects;
    }
    
    return projects;
  },
  
  // Send message to content script to toggle floating UI
  toggleFloatingUI: function(projectName, enabled) {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'toggleFloatingUI',
          enabled: enabled,
          projectName: projectName
        });
      }
    });
  }
};

// Protocol related functions
const ProtocolTools = {
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
      const regex = new RegExp('^' + regexPattern + '$');
      return regex.test(domain);
    } catch (e) {
      console.error('Invalid pattern:', pattern, e);
      return false;
    }
  }
};

// UI helper functions
const UiTools = {
  // Copy text to clipboard
  copyToClipboard: function(text, callback, errorCallback) {
    navigator.clipboard.writeText(text).then(callback).catch(errorCallback);
  }
};

// Public API - Environment Switcher namespace
const EnvSwitcher = {
  storage: Storage,
  url: UrlTools,
  project: ProjectTools,
  protocol: ProtocolTools,
  ui: UiTools,
  
  // Main getter for all settings (backward compatibility)
  getSettings: function(callback) {
    Storage.getSettings(callback);
  },
  
  // Main setter for a setting (backward compatibility)
  saveSetting: function(key, value, callback) {
    Storage.saveSetting(key, value, callback);
  },
  
  // Main setter for multiple settings (backward compatibility)
  saveSettings: function(settings, callback) {
    Storage.saveSettings(settings, callback);
  }
};

// Export the EnvSwitcher object
window.EnvSwitcher = EnvSwitcher; 