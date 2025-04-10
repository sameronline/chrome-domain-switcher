/**
 * Floating UI Component for Environment Switcher
 */

import { parseUrl } from '../utils/domainUtils.js';
import { loadCSS, removeCSS, createElement, showToast, copyToClipboard } from '../utils/uiUtils.js';
import { buildUrl, navigateTo } from '../services/navigationService.js';
import { saveSetting, STORAGE_KEYS } from '../services/storageService.js';

export class FloatingUI {
  /**
   * Constructor
   * @param {Object} config - Configuration object
   */
  constructor(config) {
    this.config = config;
    this.projects = config.projects || [];
    this.protocolRules = config.protocolRules || [];
    this.showProtocol = config.showProtocol !== undefined ? config.showProtocol : true;
    this.autoCollapse = config.autoCollapse !== undefined ? config.autoCollapse : true;
    this.autoRedirect = config.autoRedirect !== undefined ? config.autoRedirect : true;
    this.newWindow = config.newWindow !== undefined ? config.newWindow : false;
    this.collapsed = config.collapsed !== undefined ? config.collapsed : true;
    this.incognitoMode = config.incognitoMode !== undefined ? config.incognitoMode : false;
    
    // Current URL info
    const urlInfo = parseUrl(window.location.href);
    this.currentUrl = window.location.href;
    this.currentProtocol = window.location.protocol;
    this.currentHostname = window.location.hostname;
    this.currentPath = window.location.pathname + window.location.search + window.location.hash;
    
    // Current project and domains
    this.currentProject = config.currentProject || null;
    this.currentProjectDomains = config.currentProject?.domains || [];
    
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
  }
  
  /**
   * Initialize floating UI
   */
  async initialize() {
    try {
      // Load CSS
      await this.loadFloatingUiCSS();
      
      // Build UI
      this.buildUI();
      
      // Only continue if UI was built successfully
      if (!this.container) {
        return;
      }
      
      // Add to DOM
      this.appendToDOM();
      
      // Add event listeners
      this.addEventListeners();
      
      return this;
    } catch (error) {
      console.error('Failed to initialize floating UI:', error);
      return null;
    }
  }
  
  /**
   * Load floating UI CSS
   */
  loadFloatingUiCSS() {
    return loadCSS(
      chrome.runtime.getURL('styles/floating-ui.css'),
      'env-switcher-floating-ui-css'
    );
  }
  
  /**
   * Remove floating UI CSS
   */
  removeFloatingUiCSS() {
    removeCSS('env-switcher-floating-ui-css');
  }
  
  /**
   * Build UI elements
   */
  buildUI() {
    // Main container
    this.container = createElement('div', {
      className: 'env-switcher-container',
      id: 'env-switcher-floating-ui'
    });
    
    // Toggle button
    this.toggleButton = createElement('button', {
      className: 'env-switcher-toggle-button',
      title: 'Toggle Environment Switcher',
      onClick: () => this.toggleCollapse()
    }, [
      createElement('div', { className: 'env-switcher-toggle-icon' })
    ]);
    
    this.container.appendChild(this.toggleButton);
    
    // Content wrapper (collapsible)
    this.contentWrapper = createElement('div', {
      className: this.collapsed ? 'env-switcher-content collapsed' : 'env-switcher-content'
    });
    
    this.container.appendChild(this.contentWrapper);
    
    // Create form elements
    this.buildFormElements();
  }
  
  /**
   * Build form elements
   */
  buildFormElements() {
    // Project selector (only show if more than one project)
    if (this.projects.length > 1) {
      const projectSelectContainer = createElement('div', {
        className: 'env-switcher-field'
      });
      
      const projectLabel = createElement('label', {}, 'Project');
      projectSelectContainer.appendChild(projectLabel);
      
      this.projectSelect = createElement('select', {
        className: 'env-switcher-select',
        onChange: () => this.updateDomainOptions()
      });
      
      // Add project options
      for (const project of this.projects) {
        const option = createElement('option', {
          value: project.name,
          selected: this.currentProject && project.name === this.currentProject.name
        }, project.name);
        
        this.projectSelect.appendChild(option);
      }
      
      projectSelectContainer.appendChild(this.projectSelect);
      this.contentWrapper.appendChild(projectSelectContainer);
    }
    
    // Domain selector
    const domainSelectContainer = createElement('div', {
      className: 'env-switcher-field'
    });
    
    const domainLabel = createElement('label', {}, 'Environment');
    domainSelectContainer.appendChild(domainLabel);
    
    this.domainSelect = createElement('select', {
      className: 'env-switcher-select',
      onChange: () => {
        // Auto-redirect if enabled
        if (this.autoRedirect) {
          this.navigateToSelectedEnvironment();
        }
      }
    });
    
    // Domain options will be populated in updateDomainOptions()
    domainSelectContainer.appendChild(this.domainSelect);
    this.contentWrapper.appendChild(domainSelectContainer);
    
    // Protocol selector (if enabled)
    if (this.showProtocol) {
      const protocolSelectContainer = createElement('div', {
        className: 'env-switcher-field'
      });
      
      const protocolLabel = createElement('label', {}, 'Protocol');
      protocolSelectContainer.appendChild(protocolLabel);
      
      this.protocolSelect = createElement('select', {
        className: 'env-switcher-select'
      });
      
      // Add protocol options
      const httpOption = createElement('option', {
        value: 'http:',
        selected: this.currentProtocol === 'http:'
      }, 'HTTP');
      
      const httpsOption = createElement('option', {
        value: 'https:',
        selected: this.currentProtocol === 'https:'
      }, 'HTTPS');
      
      this.protocolSelect.appendChild(httpOption);
      this.protocolSelect.appendChild(httpsOption);
      
      protocolSelectContainer.appendChild(this.protocolSelect);
      this.contentWrapper.appendChild(protocolSelectContainer);
    }
    
    // Go button (only shown if auto-redirect is disabled)
    if (!this.autoRedirect) {
      this.goButton = createElement('button', {
        className: 'env-switcher-button env-switcher-go-button',
        onClick: () => this.navigateToSelectedEnvironment()
      }, 'Go');
      
      this.contentWrapper.appendChild(this.goButton);
    }
    
    // Copy buttons
    const copyContainer = createElement('div', {
      className: 'env-switcher-button-group'
    });
    
    this.copyPathButton = createElement('button', {
      className: 'env-switcher-button env-switcher-copy-button',
      title: 'Copy Path',
      onClick: () => this.copyCurrentPath()
    }, 'Copy Path');
    
    this.copyUrlButton = createElement('button', {
      className: 'env-switcher-button env-switcher-copy-button',
      title: 'Copy URL',
      onClick: () => this.copyCurrentUrl()
    }, 'Copy URL');
    
    copyContainer.appendChild(this.copyPathButton);
    copyContainer.appendChild(this.copyUrlButton);
    this.contentWrapper.appendChild(copyContainer);
    
    // Populate domain options
    this.updateDomainOptions();
  }
  
  /**
   * Update domain options based on selected project
   */
  updateDomainOptions() {
    // Clear existing options
    this.domainSelect.innerHTML = '';
    
    // Get the current project
    let selectedProject = this.currentProject;
    
    // If project selector exists, use the selected project
    if (this.projectSelect) {
      const projectName = this.projectSelect.value;
      selectedProject = this.projects.find(p => p.name === projectName);
    }
    
    if (!selectedProject || !selectedProject.domains) {
      return;
    }
    
    // Add domain options
    for (const domainEntry of selectedProject.domains) {
      const domain = typeof domainEntry === 'string' ? domainEntry : domainEntry.domain;
      const label = typeof domainEntry === 'string' ? domain : (domainEntry.label || domain);
      
      const option = createElement('option', {
        value: domain,
        selected: domain === this.currentHostname
      }, label);
      
      this.domainSelect.appendChild(option);
    }
  }
  
  /**
   * Navigate to selected environment
   */
  navigateToSelectedEnvironment() {
    const selectedDomain = this.domainSelect.value;
    const selectedProtocol = this.protocolSelect ? this.protocolSelect.value : this.currentProtocol;
    
    if (!selectedDomain) {
      return;
    }
    
    // Build URL
    const url = buildUrl(
      selectedDomain,
      selectedProtocol,
      this.currentPath,
      this.protocolRules
    );
    
    // Navigate
    navigateTo(url, this.newWindow, this.incognitoMode);
  }
  
  /**
   * Append UI to DOM
   */
  appendToDOM() {
    if (this.container && !document.getElementById('env-switcher-floating-ui')) {
      document.body.appendChild(this.container);
    }
  }
  
  /**
   * Show the UI
   */
  show() {
    if (this.container) {
      this.container.style.display = 'block';
    }
  }
  
  /**
   * Hide the UI
   */
  hide() {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }
  
  /**
   * Toggle collapse state
   */
  toggleCollapse() {
    this.collapsed = !this.collapsed;
    
    if (this.contentWrapper) {
      if (this.collapsed) {
        this.contentWrapper.classList.add('collapsed');
      } else {
        this.contentWrapper.classList.remove('collapsed');
      }
    }
    
    // Save collapsed state
    saveSetting(STORAGE_KEYS.COLLAPSED_STATE, this.collapsed);
  }
  
  /**
   * Copy current URL
   */
  copyCurrentUrl() {
    copyToClipboard(
      window.location.href,
      () => showToast('URL copied to clipboard'),
      () => showToast('Failed to copy URL')
    );
  }
  
  /**
   * Copy current path
   */
  copyCurrentPath() {
    copyToClipboard(
      this.currentPath,
      () => showToast('Path copied to clipboard'),
      () => showToast('Failed to copy path')
    );
  }
  
  /**
   * Add event listeners
   */
  addEventListeners() {
    // Handle escape key to collapse UI
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.collapsed) {
        this.toggleCollapse();
      }
    });
    
    // Auto-collapse when clicking outside
    if (this.autoCollapse) {
      document.addEventListener('click', (e) => {
        if (!this.collapsed && this.container && !this.container.contains(e.target)) {
          this.toggleCollapse();
        }
      });
    }
  }
  
  /**
   * Destroy the UI
   */
  destroy() {
    // Remove event listeners (would need to store references to bound functions)
    
    // Remove CSS
    this.removeFloatingUiCSS();
    
    // Remove from DOM
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
} 