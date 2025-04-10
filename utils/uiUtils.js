/**
 * UI utility functions for Environment Switcher
 */

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @param {Function} callback - Success callback
 * @param {Function} errorCallback - Error callback
 */
export function copyToClipboard(text, callback, errorCallback) {
  navigator.clipboard.writeText(text).then(callback).catch(errorCallback);
}

/**
 * Create a toast notification
 * @param {string} message - Message to display
 * @param {number} duration - Duration in ms
 */
export function showToast(message, duration = 3000) {
  // Check if there's already a toast container
  let toastContainer = document.getElementById('env-switcher-toast-container');
  
  if (!toastContainer) {
    // Create a container for toasts if it doesn't exist
    toastContainer = document.createElement('div');
    toastContainer.id = 'env-switcher-toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 10000;
    `;
    document.body.appendChild(toastContainer);
  }
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = 'env-switcher-toast';
  toast.textContent = message;
  
  // Add toast to container
  toastContainer.appendChild(toast);
  
  // Remove toast after duration
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
      
      // Remove container if it's empty
      if (toastContainer.childNodes.length === 0) {
        toastContainer.remove();
      }
    }
  }, duration);
}

/**
 * Create element with attributes and children
 * @param {string} tag - Tag name
 * @param {Object} attrs - Attributes object
 * @param {Array|Node|string} children - Child elements
 * @returns {HTMLElement} - Created element
 */
export function createElement(tag, attrs = {}, children = []) {
  const element = document.createElement(tag);
  
  // Set attributes
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      const eventName = key.substring(2).toLowerCase();
      element.addEventListener(eventName, value);
    } else {
      element.setAttribute(key, value);
    }
  }
  
  // Add children
  if (Array.isArray(children)) {
    for (const child of children) {
      if (child) {
        element.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
      }
    }
  } else if (children) {
    element.appendChild(typeof children === 'string' ? document.createTextNode(children) : children);
  }
  
  return element;
}

/**
 * Load CSS file dynamically
 * @param {string} cssUrl - URL of CSS file
 * @param {string} id - ID for the style element
 * @returns {Promise} - Promise resolved when CSS is loaded
 */
export function loadCSS(cssUrl, id) {
  // Check if already loaded
  if (document.getElementById(id)) {
    return Promise.resolve();
  }
  
  // Create link element
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.id = id;
  link.href = cssUrl;
  
  // Return promise
  return new Promise((resolve, reject) => {
    link.onload = resolve;
    link.onerror = reject;
    document.head.appendChild(link);
  });
}

/**
 * Remove CSS file
 * @param {string} id - ID of the style element
 */
export function removeCSS(id) {
  const link = document.getElementById(id);
  if (link && link.parentNode) {
    link.parentNode.removeChild(link);
  }
} 