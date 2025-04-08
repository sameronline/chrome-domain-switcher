document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const projectSelect = document.getElementById('project');
  const domainSelect = document.getElementById('domain');
  const protocolSelect = document.getElementById('protocol');
  const goButton = document.getElementById('go-btn');
  const autoRedirectCheckbox = document.getElementById('auto-redirect');
  const newWindowCheckbox = document.getElementById('new-window');
  const copyPathButton = document.getElementById('copy-path');
  const copyUrlButton = document.getElementById('copy-url');
  const configureButton = document.getElementById('configure-btn');
  const toggleFloatingButton = document.getElementById('toggle-floating');
  
  // Current URL info
  let currentUrl, currentProtocol, currentHostname, currentPath;
  
  // User preferences
  let autoRedirect = true;
  let newWindow = false;
  let projects = [];
  let protocolRules = [];
  
  // Current project and domains
  let currentProject = null;
  let currentProjectDomains = [];
  
  // Initialize the extension
  function init() {
    // Use shared settings loader
    EnvSwitcher.getSettings(function(items) {
      projects = items.projects;
      protocolRules = items.protocolRules;
      autoRedirect = items.autoRedirect;
      newWindow = items.newWindow;
      
      // Update UI based on preferences
      autoRedirectCheckbox.checked = autoRedirect;
      newWindowCheckbox.checked = newWindow;
      
      // Check if Go button should be shown based on auto-redirect
      updateGoButtonVisibility();
      
      // Get current tab information
      getCurrentTabInfo();
    });
  }
  
  function updateGoButtonVisibility() {
    // If auto-redirect is enabled, just reduce opacity but keep visible
    goButton.style.opacity = autoRedirect ? '0.5' : '1';
    goButton.style.pointerEvents = autoRedirect ? 'none' : 'auto';
  }
  
  // Get information about the current tab
  function getCurrentTabInfo() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs && tabs.length > 0) {
        const tab = tabs[0];
        
        // Use shared URL parser
        const urlInfo = EnvSwitcher.url.parseUrl(tab.url);
        
        if (urlInfo.valid) {
          currentUrl = tab.url;
          currentProtocol = urlInfo.protocol;
          currentHostname = urlInfo.hostname;
          currentPath = urlInfo.path;
          
          // Update protocol select
          protocolSelect.value = currentProtocol;
          
          // Check for protocol rules
          const forcedProtocol = EnvSwitcher.protocol.getForcedProtocol(currentHostname, protocolRules);
          if (forcedProtocol) {
            protocolSelect.value = forcedProtocol;
            protocolSelect.disabled = true;
          } else {
            protocolSelect.disabled = false;
          }
          
          // Find current project and populate dropdowns
          findCurrentProject();
          populateProjects();
        } else {
          // Handle non-HTTP URLs (e.g., chrome://, about:, etc.)
          disableControls();
        }
      }
    });
  }
  
  function disableControls() {
    projectSelect.disabled = true;
    domainSelect.disabled = true;
    protocolSelect.disabled = true;
    goButton.disabled = true;
    copyUrlButton.disabled = true;
  }
  
  // Find which project the current domain belongs to
  function findCurrentProject() {
    currentProject = EnvSwitcher.project.findProjectForDomain(currentHostname, projects);
  }
  
  // Populate the project dropdown
  function populateProjects() {
    // Clear existing options
    projectSelect.innerHTML = '';
    
    // Add all projects
    projects.forEach(project => {
      const option = document.createElement('option');
      option.value = project.name;
      option.textContent = project.name;
      option.selected = currentProject && project.name === currentProject.name;
      projectSelect.appendChild(option);
    });
    
    // If we found the current project, populate its domains
    if (currentProject) {
      populateDomains(currentProject);
      updateToggleButton();
    } else if (projects.length > 0) {
      // If current domain isn't in any project, select the first project
      populateDomains(projects[0]);
      updateToggleButton();
    }
  }
  
  // Populate the domain dropdown with domains from the selected project
  function populateDomains(project) {
    // Store the current project
    currentProject = project;
    currentProjectDomains = project.domains;
    
    // Clear existing options
    domainSelect.innerHTML = '';
    
    // Add domains from this project
    project.domains.forEach(domain => {
      const option = document.createElement('option');
      option.value = domain;
      option.textContent = domain;
      option.selected = domain === currentHostname;
      domainSelect.appendChild(option);
    });
    
    // If current hostname isn't in the project but we're on a valid domain,
    // add it as a temporary option
    if (currentHostname && !project.domains.includes(currentHostname)) {
      const option = document.createElement('option');
      option.value = currentHostname;
      option.textContent = currentHostname + ' (current)';
      option.selected = true;
      domainSelect.appendChild(option);
    }
    
    // Update toggle button for the selected project
    updateToggleButton();
  }
  
  // Update the toggle button text based on current project's floating UI state
  function updateToggleButton() {
    if (currentProject) {
      const isEnabled = currentProject.floatingEnabled === true;
      toggleFloatingButton.textContent = isEnabled ? 'Disable Floating UI' : 'Enable Floating UI';
      toggleFloatingButton.style.background = isEnabled ? '#e74c3c' : 'var(--secondary-color)';
    }
  }
  
  // Build URL with selected domain and protocol
  function buildTargetUrl() {
    return EnvSwitcher.url.buildUrl(
      domainSelect.value,
      protocolSelect.value,
      currentPath,
      protocolRules
    );
  }
  
  // Event: Project select change
  projectSelect.addEventListener('change', function() {
    const selectedProjectName = this.value;
    const selectedProject = projects.find(p => p.name === selectedProjectName);
    
    if (selectedProject) {
      populateDomains(selectedProject);
    }
  });
  
  // Event: Domain select change
  domainSelect.addEventListener('change', function() {
    // Update protocol according to rules
    const forcedProtocol = EnvSwitcher.protocol.getForcedProtocol(this.value, protocolRules);
    if (forcedProtocol) {
      protocolSelect.value = forcedProtocol;
      protocolSelect.disabled = true;
    } else {
      protocolSelect.disabled = false;
    }
    
    // If auto-redirect is enabled, navigate immediately
    if (autoRedirect) {
      EnvSwitcher.url.navigate(buildTargetUrl(), newWindow);
    }
  });
  
  // Event: Protocol select change
  protocolSelect.addEventListener('change', function() {
    // If auto-redirect is enabled, navigate immediately
    if (autoRedirect) {
      EnvSwitcher.url.navigate(buildTargetUrl(), newWindow);
    }
  });
  
  // Event: Go button click
  goButton.addEventListener('click', function() {
    EnvSwitcher.url.navigate(buildTargetUrl(), newWindow);
  });
  
  // Event: Auto-redirect checkbox change
  autoRedirectCheckbox.addEventListener('change', function() {
    autoRedirect = this.checked;
    updateGoButtonVisibility();
    
    // Save preference
    EnvSwitcher.saveSetting(EnvSwitcher.storage.keys.AUTO_REDIRECT, autoRedirect);
  });
  
  // Event: New window checkbox change
  newWindowCheckbox.addEventListener('change', function() {
    newWindow = this.checked;
    
    // Save preference
    EnvSwitcher.saveSetting(EnvSwitcher.storage.keys.NEW_WINDOW, newWindow);
  });
  
  // Event: Copy path button click
  copyPathButton.addEventListener('click', function() {
    const button = this;
    const originalText = button.textContent;
    const originalBg = button.style.background;
    
    EnvSwitcher.ui.copyToClipboard(
      currentPath,
      function() {
        button.textContent = '✓ Copied!';
        button.style.background = 'var(--secondary-color)';
        
        setTimeout(() => {
          button.textContent = originalText;
          button.style.background = originalBg;
        }, 1500);
      },
      function(err) {
        console.error('Could not copy text: ', err);
        button.textContent = '❌ Error';
        setTimeout(() => {
          button.textContent = originalText;
        }, 1500);
      }
    );
  });
  
  // Event: Copy URL button click
  copyUrlButton.addEventListener('click', function() {
    const button = this;
    const originalText = button.textContent;
    const originalBg = button.style.background;
    
    EnvSwitcher.ui.copyToClipboard(
      buildTargetUrl(),
      function() {
        button.textContent = '✓ Copied!';
        button.style.background = 'var(--secondary-color)';
        
        setTimeout(() => {
          button.textContent = originalText;
          button.style.background = originalBg;
        }, 1500);
      },
      function(err) {
        console.error('Could not copy text: ', err);
        button.textContent = '❌ Error';
        setTimeout(() => {
          button.textContent = originalText;
        }, 1500);
      }
    );
  });
  
  // Event: Configure button click
  configureButton.addEventListener('click', function(e) {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
  
  // Event: Toggle floating UI button click
  toggleFloatingButton.addEventListener('click', function() {
    if (!currentProject) return;
    
    // Toggle the current project's floating UI status
    const newStatus = !currentProject.floatingEnabled;
    
    // Update projects array with the new status
    projects = EnvSwitcher.project.updateFloatingUIStatus(
      currentProject.name,
      projects,
      newStatus,
      function() {
        console.log(`Floating UI ${newStatus ? 'enabled' : 'disabled'} for project: ${currentProject.name}`);
      }
    );
    
    // Update current project object
    currentProject.floatingEnabled = newStatus;
    
    // Update UI
    updateToggleButton();
    
    // Send message to content script
    EnvSwitcher.project.toggleFloatingUI(currentProject.name, newStatus);
  });
  
  // Initialize the extension
  init();
}); 