/**
 * Navigation service for Environment Switcher
 */

import { getForcedProtocol } from '../utils/domainUtils.js';

/**
 * Navigate to a URL
 * @param {string} url - URL to navigate to
 * @param {boolean} newWindow - Open in new window
 * @param {boolean} incognitoMode - Open in incognito window
 */
export function navigateTo(url, newWindow, incognitoMode) {
  if (incognitoMode) {
    // Open in incognito window
    chrome.runtime.sendMessage({
      action: 'openIncognito',
      url: url
    });
  } else if (newWindow) {
    // Open in new window
    chrome.tabs.create({ url: url });
  } else {
    // Update current tab
    chrome.tabs.update({ url: url });
  }
}

/**
 * Build URL with domain and protocol
 * @param {string} domain - Domain
 * @param {string} protocol - Protocol
 * @param {string} path - Path
 * @param {Array} protocolRules - Protocol rules
 * @returns {string} - Complete URL
 */
export function buildUrl(domain, protocol, path, protocolRules) {
  // Force protocol if needed
  const forcedProtocol = getForcedProtocol(domain, protocolRules);
  const finalProtocol = forcedProtocol || protocol;
  
  return `${finalProtocol}//${domain}${path}`;
}

/**
 * Send message to toggle floating UI
 * @param {string} projectName - Project name
 * @param {boolean} enabled - Enabled state
 */
export function toggleFloatingUI(projectName, enabled) {
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

/**
 * Get current tab information
 * @param {Function} callback - Callback function
 */
export function getCurrentTab(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs && tabs.length > 0) {
      callback(tabs[0]);
    } else {
      callback(null);
    }
  });
} 