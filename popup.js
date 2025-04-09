document.addEventListener('DOMContentLoaded', function() {
  // DOM elements that exist in the HTML
  const projectNameElement = document.getElementById('project-name');
  const toggleFloatingButton = document.getElementById('toggle-floating');
  const configureButton = document.getElementById('configure-btn');
  
  // Current project
  let currentProject = null;
  
  // Initialize the extension
  function init() {
    // Get current tab information
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs && tabs.length > 0) {
        const tab = tabs[0];
        
        try {
          // Parse the current URL
          const urlObj = new URL(tab.url);
          const currentHostname = urlObj.hostname;
          
          if (currentHostname) {
            // Load projects from storage
            chrome.storage.sync.get('projects', function(data) {
              console.log('Loaded projects:', data.projects);
              const projects = data.projects || [];
              
              // Find project for the current hostname
              currentProject = null;
              for (const project of projects) {
                if (project.domains && project.domains.includes(currentHostname)) {
                  currentProject = project;
                  break;
                }
              }
              
              // Update UI based on current project
              if (currentProject) {
                projectNameElement.textContent = currentProject.name;
                updateToggleButton();
              } else {
                projectNameElement.textContent = "Unknown Domain";
                toggleFloatingButton.disabled = true;
              }
            });
          } else {
            projectNameElement.textContent = "Not available";
            toggleFloatingButton.disabled = true;
          }
        } catch (e) {
          console.error("Error parsing URL:", e);
          projectNameElement.textContent = "Error";
          toggleFloatingButton.disabled = true;
        }
      }
    });
  }
  
  // Update toggle button state
  function updateToggleButton() {
    if (currentProject) {
      const isEnabled = currentProject.floatingEnabled === true;
      toggleFloatingButton.textContent = isEnabled ? 'Hide Floating UI' : 'Show Floating UI';
      toggleFloatingButton.style.background = isEnabled ? '#e74c3c' : '#4CAF50';
      toggleFloatingButton.disabled = false;
    }
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
  
  // Start initialization
  init();
}); 