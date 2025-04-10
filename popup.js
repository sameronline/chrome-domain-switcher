/**
 * Popup script for Environment Switcher
 */

import { parseUrl, matchesDomain, getDomainValue } from './utils/domainUtils.js';
import { getSettings, saveSetting, STORAGE_KEYS } from './services/storageService.js';
import { navigateTo, toggleFloatingUI, getCurrentTab } from './services/navigationService.js';
import { copyToClipboard, showToast } from './utils/uiUtils.js';

// DOM elements
let projectNameElement;
let toggleFloatingButton;
let configureButton;
let domainSelect;
let protocolSelect;
let goButton;
let copyPathButton;
let copyUrlButton;
let autoRedirectCheckbox;
let newWindowCheckbox;
let incognitoCheckbox;

// Current URL info
let currentTab = null;
let currentUrl = '';
let currentHostname = '';
let currentPath = '';
let currentProtocol = '';

// Current settings
let currentProject = null;
let currentSettings = null;

/**
 * Initialize the popup
 */
function init() {
  // Initialize DOM elements
  projectNameElement = document.getElementById('project-name');
  toggleFloatingButton = document.getElementById('toggle-floating');
  configureButton = document.getElementById('configure-btn');
  domainSelect = document.getElementById('domain-select');
  protocolSelect = document.getElementById('protocol-select');
  goButton = document.getElementById('go-button');
  copyPathButton = document.getElementById('copy-path');
  copyUrlButton = document.getElementById('copy-url');
  autoRedirectCheckbox = document.getElementById('auto-redirect');
  newWindowCheckbox = document.getElementById('new-window');
  incognitoCheckbox = document.getElementById('incognito-mode');
  
  // Get current tab information
  getCurrentTab((tab) => {
    if (!tab) {
      showError('No active tab found');
      return;
    }
    
    currentTab = tab;
    
    try {
      // Parse URL
      const urlInfo = parseUrl(tab.url);
      if (!urlInfo.valid) {
        showError('Not a valid URL');
        return;
      }
      
      currentUrl = tab.url;
      currentHostname = urlInfo.hostname;
      currentPath = urlInfo.path;
      currentProtocol = urlInfo.protocol;
      
      // Load settings
      loadSettings();
      
      // Add event listeners
      addEventListeners();
    } catch (error) {
      showError('Error parsing URL: ' + error.message);
    }
  });
}

/**
 * Load settings from storage
 */
function loadSettings() {
  getSettings((settings) => {
    currentSettings = settings;
    
    // Auto-add domain if it matches a wildcard pattern
    settings.projects = autoAddDomainIfMatchesWildcard(currentHostname, settings.projects);
    
    // Find current project
    currentProject = null;
    for (const project of settings.projects) {
      if (project.domains) {
        // Check each domain pattern in the project
        for (const domainEntry of project.domains) {
          const domain = getDomainValue(domainEntry);
          if (domain === currentHostname || matchesDomain(currentHostname, domain)) {
            currentProject = project;
            break;
          }
        }
        if (currentProject) break; // Exit the outer loop if project found
      }
    }
    
    // Update UI
    updateUI(settings);
  });
}

/**
 * Update UI with current settings
 * @param {Object} settings - Current settings
 */
function updateUI(settings) {
  // Update project name
  if (currentProject) {
    projectNameElement.textContent = currentProject.name;
    updateToggleButton();
  } else {
    projectNameElement.textContent = "None (Unknown Domain)";
    toggleFloatingButton.classList.add('env-switcher__toggle-btn--disabled');
    toggleFloatingButton.disabled = true;
  }
  
  // Update checkbox states
  autoRedirectCheckbox.checked = settings.autoRedirect;
  newWindowCheckbox.checked = settings.newWindow;
  incognitoCheckbox.checked = settings.incognitoMode;
  
  // Update domain options
  updateDomainOptions();
  
  // Update protocol options
  if (protocolSelect) {
    const httpOption = document.createElement('option');
    httpOption.value = 'http:';
    httpOption.textContent = 'HTTP';
    httpOption.selected = currentProtocol === 'http:';
    
    const httpsOption = document.createElement('option');
    httpsOption.value = 'https:';
    httpsOption.textContent = 'HTTPS';
    httpsOption.selected = currentProtocol === 'https:';
    
    protocolSelect.innerHTML = '';
    protocolSelect.appendChild(httpOption);
    protocolSelect.appendChild(httpsOption);
  }
  
  // Show/hide go button based on auto-redirect setting
  if (goButton) {
    goButton.style.display = settings.autoRedirect ? 'none' : 'block';
  }
}

/**
 * Update domain options
 */
function updateDomainOptions() {
  if (!domainSelect) return;
  
  // Clear existing options
  domainSelect.innerHTML = '';
  
  if (!currentProject) return;
  
  // Add domain options
  for (const domainEntry of currentProject.domains) {
    const domain = getDomainValue(domainEntry);
    const label = typeof domainEntry === 'string' ? domain : (domainEntry.label || domain);
    
    const option = document.createElement('option');
    option.value = domain;
    option.textContent = label;
    option.selected = domain === currentHostname;
    
    domainSelect.appendChild(option);
  }
}

/**
 * Update toggle button based on project state
 */
function updateToggleButton() {
  // Remove all state classes
  toggleFloatingButton.classList.remove('env-switcher__toggle-btn--hide', 'env-switcher__toggle-btn--disabled');
  
  if (currentProject) {
    const isEnabled = currentProject.floatingEnabled === true;
    toggleFloatingButton.textContent = isEnabled ? 'Hide Floating UI' : 'Show Floating UI';
    
    if (isEnabled) {
      toggleFloatingButton.classList.add('env-switcher__toggle-btn--hide');
    }
    
    toggleFloatingButton.disabled = false;
  } else {
    // No project found, disable the button
    toggleFloatingButton.textContent = 'Show Floating UI';
    toggleFloatingButton.classList.add('env-switcher__toggle-btn--disabled');
    toggleFloatingButton.disabled = true;
  }
}

/**
 * Auto-add domain if it matches a wildcard pattern
 * @param {string} hostname - The hostname to check
 * @param {Array} projects - Projects array
 * @returns {Array} - Updated projects array
 */
function autoAddDomainIfMatchesWildcard(hostname, projects) {
  // First check if the domain is already in any project
  let exactMatch = false;
  
  for (const project of projects) {
    if (project.domains) {
      const hasExactMatch = project.domains.some(entry => {
        const domainValue = getDomainValue(entry);
        return domainValue === hostname;
      });
      
      if (hasExactMatch) {
        exactMatch = true;
        break;
      }
    }
  }
  
  // If we already have an exact match, no need to check for wildcard matches
  if (exactMatch) {
    return projects;
  }
  
  // Check for wildcard matches
  let projectsUpdated = false;
  
  for (const project of projects) {
    if (project.domains) {
      for (const domainEntry of project.domains) {
        const domain = getDomainValue(domainEntry);
        
        // Skip non-wildcard domains
        if (!domain.includes('*')) {
          continue;
        }
        
        if (matchesDomain(hostname, domain)) {
          // Extract the portion that matches the wildcard
          const wildcardPortion = extractWildcardPortion(hostname, domain);
          
          // Add the current domain to this project with the extracted portion as label
          project.domains.push({
            domain: hostname,
            label: wildcardPortion
          });
          
          projectsUpdated = true;
          break;
        }
      }
      
      if (projectsUpdated) {
        break;
      }
    }
  }
  
  // If we added a domain, save the updated projects list
  if (projectsUpdated) {
    saveSetting(STORAGE_KEYS.PROJECTS, projects);
  }
  
  return projects;
}

/**
 * Extract wildcard portion from domain
 * @param {string} fullDomain - Full domain
 * @param {string} wildcardPattern - Wildcard pattern
 * @returns {string} - Extracted portion
 */
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

/**
 * Add event listeners to UI elements
 */
function addEventListeners() {
  // Toggle floating UI button
  if (toggleFloatingButton) {
    toggleFloatingButton.addEventListener('click', () => {
      if (!currentProject) return;
      
      const newState = !currentProject.floatingEnabled;
      
      // Send message to content script
      toggleFloatingUI(currentProject.name, newState);
      
      // Update UI optimistically
      currentProject.floatingEnabled = newState;
      updateToggleButton();
    });
  }
  
  // Configure button
  if (configureButton) {
    configureButton.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }
  
  // Domain select
  if (domainSelect) {
    domainSelect.addEventListener('change', () => {
      if (currentSettings.autoRedirect) {
        navigateToSelectedDomain();
      }
    });
  }
  
  // Protocol select
  if (protocolSelect) {
    protocolSelect.addEventListener('change', () => {
      if (currentSettings.autoRedirect) {
        navigateToSelectedDomain();
      }
    });
  }
  
  // Go button
  if (goButton) {
    goButton.addEventListener('click', () => {
      navigateToSelectedDomain();
    });
  }
  
  // Auto-redirect checkbox
  if (autoRedirectCheckbox) {
    autoRedirectCheckbox.addEventListener('change', () => {
      currentSettings.autoRedirect = autoRedirectCheckbox.checked;
      saveSetting(STORAGE_KEYS.AUTO_REDIRECT, autoRedirectCheckbox.checked);
      
      // Show/hide go button
      if (goButton) {
        goButton.style.display = autoRedirectCheckbox.checked ? 'none' : 'block';
      }
    });
  }
  
  // New window checkbox
  if (newWindowCheckbox) {
    newWindowCheckbox.addEventListener('change', () => {
      currentSettings.newWindow = newWindowCheckbox.checked;
      saveSetting(STORAGE_KEYS.NEW_WINDOW, newWindowCheckbox.checked);
    });
  }
  
  // Incognito checkbox
  if (incognitoCheckbox) {
    incognitoCheckbox.addEventListener('change', () => {
      currentSettings.incognitoMode = incognitoCheckbox.checked;
      saveSetting(STORAGE_KEYS.INCOGNITO_MODE, incognitoCheckbox.checked);
    });
  }
  
  // Copy path button
  if (copyPathButton) {
    copyPathButton.addEventListener('click', () => {
      copyToClipboard(
        currentPath,
        () => showToast('Path copied to clipboard'),
        () => showToast('Failed to copy path')
      );
    });
  }
  
  // Copy URL button
  if (copyUrlButton) {
    copyUrlButton.addEventListener('click', () => {
      copyToClipboard(
        currentUrl,
        () => showToast('URL copied to clipboard'),
        () => showToast('Failed to copy URL')
      );
    });
  }
}

/**
 * Navigate to selected domain
 */
function navigateToSelectedDomain() {
  if (!domainSelect) return;
  
  const domain = domainSelect.value;
  const protocol = protocolSelect ? protocolSelect.value : currentProtocol;
  
  // Build URL
  let url = `${protocol}//${domain}${currentPath}`;
  
  // Navigate
  navigateTo(url, currentSettings.newWindow, currentSettings.incognitoMode);
}

/**
 * Show error message
 * @param {string} message - Error message
 */
function showError(message) {
  const errorElement = document.createElement('div');
  errorElement.className = 'env-switcher__error';
  errorElement.textContent = message;
  
  // Replace content with error message
  document.body.innerHTML = '';
  document.body.appendChild(errorElement);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init); 