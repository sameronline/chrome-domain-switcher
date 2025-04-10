/**
 * Background script for Environment Switcher
 */

import { initializeDefaultSettings } from './services/storageService.js';

// Initialize default settings when extension is installed
chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === 'install') {
    initializeDefaultSettings();
  }
});

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  // Handle opening URLs in incognito window
  if (message.action === 'openIncognito') {
    chrome.windows.create({
      url: message.url,
      incognito: true
    });
    return true;
  }
});