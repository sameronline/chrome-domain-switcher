/**
 * Content script for Environment Switcher
 */

import { parseUrl, matchesDomain } from './utils/domainUtils.js';
import { getSettings, findProjectForDomain, updateFloatingUIStatus, STORAGE_KEYS } from './services/storageService.js';
import { FloatingUI } from './components/FloatingUI.js';

// Store reference to active floating UI instance
let floatingUI = null;

/**
 * Main initialization function
 */
function init() {
  // Only initialize if we're in a regular web page (not extension pages or special Chrome URLs)
  if (!window.location.href.startsWith('http')) {
    return;
  }
  
  // Extract current URL information
  const urlInfo = parseUrl(window.location.href);
  if (!urlInfo.valid) {
    return;
  }
  
  // Load settings and initialize UI if enabled for this domain
  loadSettingsAndInitUI(urlInfo);
}

/**
 * Load settings and initialize UI if enabled
 * @param {Object} urlInfo - URL information
 */
function loadSettingsAndInitUI(urlInfo) {
  getSettings((settings) => {
    const currentHostname = urlInfo.hostname;
    
    // Find which project this domain belongs to
    const currentProject = findProjectForDomain(currentHostname, settings.projects);
    
    // Only initialize if a matching project is found and floating UI is enabled
    if (currentProject && currentProject.floatingEnabled === true) {
      initializeFloatingUI({
        ...settings,
        currentProject
      });
    }
  });
}

/**
 * Initialize the floating UI
 * @param {Object} config - Configuration object
 */
function initializeFloatingUI(config) {
  // If UI already exists, destroy it first
  if (floatingUI) {
    floatingUI.destroy();
    floatingUI = null;
  }
  
  // Create new floating UI instance
  floatingUI = new FloatingUI(config);
  floatingUI.initialize().catch(error => {
    console.error('Failed to initialize floating UI:', error);
  });
}

/**
 * Enable floating UI for a project
 * @param {string} projectName - Project name
 */
async function enableFloatingUI(projectName) {
  getSettings((settings) => {
    // Update project status
    const updatedProjects = updateFloatingUIStatus(
      projectName, 
      settings.projects, 
      true,
      () => {
        // Initialize UI with updated settings
        loadSettingsAndInitUI(parseUrl(window.location.href));
      }
    );
  });
}

/**
 * Disable floating UI for a project
 * @param {string} projectName - Project name
 */
function disableFloatingUI(projectName) {
  // If UI already exists, destroy it
  if (floatingUI) {
    floatingUI.destroy();
    floatingUI = null;
  }
  
  // Update project status
  getSettings((settings) => {
    updateFloatingUIStatus(
      projectName,
      settings.projects,
      false
    );
  });
}

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleFloatingUI') {
    if (message.enabled) {
      enableFloatingUI(message.projectName);
    } else {
      disableFloatingUI(message.projectName);
    }
    
    // Send response
    sendResponse({ success: true });
    return true;
  }
});

// Initialize when DOM is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
} 