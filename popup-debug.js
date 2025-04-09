document.addEventListener('DOMContentLoaded', function() {
  // DOM elements that exist in the HTML
  const projectNameElement = document.getElementById('project-name');
  const toggleFloatingButton = document.getElementById('toggle-floating');
  const configureButton = document.getElementById('configure-btn');
  
  // Add debug button
  const debugSection = document.createElement('div');
  debugSection.className = 'env-switcher__row';
  debugSection.style.marginTop = '10px';
  debugSection.style.borderTop = '1px solid #444';
  debugSection.style.paddingTop = '10px';
  
  const debugTitle = document.createElement('div');
  debugTitle.textContent = 'Debug Tools';
  debugTitle.style.fontWeight = 'bold';
  debugTitle.style.marginBottom = '5px';
  debugSection.appendChild(debugTitle);
  
  // Button to force show minimal UI
  const debugButton = document.createElement('button');
  debugButton.textContent = 'Show Debug UI';
  debugButton.className = 'env-switcher__toggle-btn';
  debugButton.addEventListener('click', forceShowMinimalUI);
  debugSection.appendChild(debugButton);
  
  // Button to check resource URLs
  const checkResourcesButton = document.createElement('button');
  checkResourcesButton.textContent = 'Check Resources';
  checkResourcesButton.className = 'env-switcher__toggle-btn';
  checkResourcesButton.style.marginLeft = '5px';
  checkResourcesButton.addEventListener('click', checkResources);
  debugSection.appendChild(checkResourcesButton);
  
  // Add the debug section to the popup
  document.querySelector('.env-switcher').appendChild(debugSection);
  
  // Current URL info
  let currentHostname;
  
  // Current project
  let currentProject = null;
  
  // Helper function to check if a hostname matches a pattern (supporting wildcards)
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
  
  // Get domain value from domain entry (which might be a string or object)
  function getDomainValue(domainEntry) {
    return typeof domainEntry === 'string' ? domainEntry : domainEntry.domain;
  }
  
  // Update the toggle button text based on current project's floating UI state
  function updateToggleButton() {
    // Remove all state classes first
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
  
  // Function to force show a minimal UI for debugging
  function forceShowMinimalUI() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(
          tabs[0].id, 
          { action: 'debugShowMinimalUI' },
          function(response) {
            if (response && response.success) {
              debugButton.textContent = 'Debug UI Shown';
              setTimeout(() => {
                debugButton.textContent = 'Show Debug UI';
              }, 1500);
            } else {
              debugButton.textContent = 'Failed - Check Console';
              setTimeout(() => {
                debugButton.textContent = 'Show Debug UI';
              }, 1500);
            }
          }
        );
      }
    });
  }
  
  // Function to check and display resource URLs
  function checkResources() {
    const resources = ['htmx.min.js', 'htmx-chrome-ext.js', 'floating-ui.html'];
    let resultsHTML = '<div style="max-width: 300px; overflow-wrap: break-word;">';
    
    resources.forEach(resource => {
      try {
        const url = chrome.runtime.getURL(resource);
        resultsHTML += `<div><strong>${resource}</strong>: ${url}</div>`;
      } catch (e) {
        resultsHTML += `<div><strong>${resource}</strong>: ERROR - ${e.message}</div>`;
      }
    });
    
    resultsHTML += '</div>';
    
    // Show results in a dialog or alert
    alert('Resource URLs:\n\n' + resources.map(r => r + ': ' + chrome.runtime.getURL(r)).join('\n'));
  }
  
  // Load settings
  function loadSettings() {
    chrome.storage.sync.get('projects', function(data) {
      let projects = data.projects || [];
      
      // Find current project
      currentProject = null;
      for (const project of projects) {
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
      
      if (currentProject) {
        // Update UI with current project
        projectNameElement.textContent = currentProject.name;
        updateToggleButton();
      } else {
        // No project found for this domain
        projectNameElement.textContent = "None (Unknown Domain)";
        toggleFloatingButton.classList.add('env-switcher__toggle-btn--disabled');
        toggleFloatingButton.disabled = true;
      }
    });
  }
  
  // Initialize the extension
  function init() {
    // Get current tab information
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs && tabs.length > 0) {
        const tab = tabs[0];
        
        try {
          // Parse the current URL
          const urlObj = new URL(tab.url);
          currentHostname = urlObj.hostname;
          
          if (currentHostname) {
            // Now load settings and find the current project
            loadSettings();
          } else {
            projectNameElement.textContent = "Not available";
            toggleFloatingButton.classList.add('env-switcher__toggle-btn--disabled');
            toggleFloatingButton.disabled = true;
          }
        } catch (e) {
          console.error("Error parsing URL:", e);
          projectNameElement.textContent = "Error";
          toggleFloatingButton.classList.add('env-switcher__toggle-btn--disabled');
          toggleFloatingButton.disabled = true;
        }
      }
    });
  }
  
  // Toggle floating UI button click handler
  toggleFloatingButton.addEventListener('click', function() {
    if (!currentProject) return;
    
    // Toggle the state
    const newState = !currentProject.floatingEnabled;
    
    // Send message to content script
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(
          tabs[0].id, 
          { 
            action: 'toggleFloatingUI',
            enabled: newState,
            projectName: currentProject.name
          },
          function(response) {
            // Update storage
            chrome.storage.sync.get('projects', function(data) {
              const projects = data.projects || [];
              const index = projects.findIndex(p => p.name === currentProject.name);
              
              if (index !== -1) {
                projects[index].floatingEnabled = newState;
                currentProject.floatingEnabled = newState;
                
                chrome.storage.sync.set({projects: projects}, function() {
                  console.log('Updated project state:', newState);
                  updateToggleButton();
                });
              }
            });
          }
        );
      }
    });
  });
  
  // Configuration button click handler
  configureButton.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });
  
  // Initialize the popup
  init();
}); 