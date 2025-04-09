document.addEventListener('DOMContentLoaded', function() {
  // DOM elements that exist in the HTML
  const projectNameElement = document.getElementById('project-name');
  const toggleFloatingButton = document.getElementById('toggle-floating');
  const configureButton = document.getElementById('configure-btn');
  
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
  
  // Auto-add a domain to a project if it matches a wildcard pattern
  function autoAddDomainIfMatchesWildcard(currentHostname, projects) {
    // First check if the domain is already in any project
    let exactMatch = false;
    
    for (const project of projects) {
      if (project.domains) {
        const hasExactMatch = project.domains.some(entry => {
          const domainValue = getDomainValue(entry);
          return domainValue === currentHostname;
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
    
    // Extract wildcard portion from domain
    function extractWildcardPortion(fullDomain, wildcardPattern) {
      // If pattern is *-something.com, extract the part that matches *
      if (wildcardPattern.startsWith('*')) {
        const suffix = wildcardPattern.substring(1); // Remove the '*'
        if (fullDomain.endsWith(suffix)) {
          return fullDomain.substring(0, fullDomain.length - suffix.length);
        }
      }
      // If pattern is something.*.com, more complex logic would be needed
      // For now returning full domain as fallback
      return fullDomain;
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
          
          if (matchesDomain(currentHostname, domain)) {
            // Extract the portion that matches the wildcard
            const wildcardPortion = extractWildcardPortion(currentHostname, domain);
            
            // Add the current domain to this project with the extracted portion as label
            project.domains.push({
              domain: currentHostname,
              label: wildcardPortion // Use the extracted portion as the label
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
      chrome.storage.sync.set({ projects: projects }, function() {
        console.log('Updated projects with auto-added domain:', currentHostname);
      });
    }
    
    return projects;
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
  
  // Load settings
  function loadSettings() {
    chrome.storage.sync.get('projects', function(data) {
      let projects = data.projects || [];
      
      // Auto-add current domain if it matches a wildcard pattern
      if (currentHostname) {
        projects = autoAddDomainIfMatchesWildcard(currentHostname, projects);
      }
      
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
  
  // Configure button click handler
  configureButton.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });
  
  // Initialize
  init();
}); 