/**
 * Storage service for Environment Switcher
 */

/**
 * Storage keys
 */
export const STORAGE_KEYS = {
  PROJECTS: 'projects',
  PROTOCOL_RULES: 'protocolRules',
  AUTO_REDIRECT: 'autoRedirect',
  NEW_WINDOW: 'newWindow',
  INCOGNITO_MODE: 'incognitoMode',
  COLLAPSED_STATE: 'collapsedState',
  SHOW_PROTOCOL: 'showProtocol',
  AUTO_COLLAPSE: 'autoCollapse',
  TOOLS: 'tools'
};

/**
 * Default settings
 */
export const DEFAULT_SETTINGS = {
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
};

/**
 * Get all settings from storage
 * @param {Function} callback - Callback function with settings
 */
export function getSettings(callback) {
  chrome.storage.sync.get({
    [STORAGE_KEYS.PROJECTS]: DEFAULT_SETTINGS.projects,
    [STORAGE_KEYS.PROTOCOL_RULES]: DEFAULT_SETTINGS.protocolRules,
    [STORAGE_KEYS.AUTO_REDIRECT]: DEFAULT_SETTINGS.autoRedirect,
    [STORAGE_KEYS.NEW_WINDOW]: DEFAULT_SETTINGS.newWindow,
    [STORAGE_KEYS.INCOGNITO_MODE]: DEFAULT_SETTINGS.incognitoMode,
    [STORAGE_KEYS.COLLAPSED_STATE]: DEFAULT_SETTINGS.collapsedState,
    [STORAGE_KEYS.SHOW_PROTOCOL]: DEFAULT_SETTINGS.showProtocol,
    [STORAGE_KEYS.AUTO_COLLAPSE]: DEFAULT_SETTINGS.autoCollapse
  }, callback);
}

/**
 * Save individual setting
 * @param {string} key - The setting key
 * @param {any} value - The setting value
 * @param {Function} callback - Optional callback function
 */
export function saveSetting(key, value, callback) {
  const data = {};
  data[key] = value;
  chrome.storage.sync.set(data, callback || function() {
    console.log(`Saved setting: ${key}`);
  });
}

/**
 * Save multiple settings at once
 * @param {Object} settings - Object with settings
 * @param {Function} callback - Optional callback function
 */
export function saveSettings(settings, callback) {
  chrome.storage.sync.set(settings, callback || function() {
    console.log('Saved multiple settings');
  });
}

/**
 * Initialize default settings for first install
 */
export function initializeDefaultSettings() {
  chrome.storage.sync.set(DEFAULT_SETTINGS, function() {
    console.log('Default settings initialized');
  });
}

/**
 * Find project for domain
 * @param {string} hostname - The hostname to find
 * @param {Array} projects - The projects array
 * @returns {Object|null} - The matching project or null
 */
export function findProjectForDomain(hostname, projects) {
  for (const project of projects) {
    if (project.domains) {
      for (const domainEntry of project.domains) {
        // Get domain value (handle both string and object formats)
        const domain = typeof domainEntry === 'string' ? domainEntry : domainEntry.domain;
        
        // Check for direct match
        if (domain === hostname) {
          return project;
        }
        
        // Check for wildcard match
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

/**
 * Update a project's floating UI status
 * @param {string} projectName - The project name
 * @param {Array} projects - The projects array
 * @param {boolean} enabled - Enabled state
 * @param {Function} callback - Optional callback function
 * @returns {Array} - Updated projects array
 */
export function updateFloatingUIStatus(projectName, projects, enabled, callback) {
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
    saveSetting(STORAGE_KEYS.PROJECTS, updatedProjects, callback);
    
    return updatedProjects;
  }
  
  return projects;
} 