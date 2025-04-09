/**
 * Shows the floating UI if it's not already visible
 */
function showFloatingUI() {
  console.log('Showing floating UI');
  if (!envSwitcherUI) {
    console.log('Creating new UI instance');
    envSwitcherUI = new EnvironmentSwitcherUI();
  }
  
  // Try to detect current project based on hostname
  const hostname = window.location.hostname;
  console.log('Current hostname:', hostname);
  
  // Get projects from storage
  chrome.storage.local.get(['projects'], function(result) {
    const projects = result.projects || [];
    console.log('Projects from storage:', projects);
    
    // Find matching project
    const matchingProject = projects.find(project => {
      return project.domains.some(domain => hostname.includes(domain));
    });
    
    if (matchingProject) {
      console.log('Found matching project:', matchingProject.name);
      envSwitcherUI.enableForProject(matchingProject);
    } else {
      console.log('No matching project found for:', hostname);
      // Show debug UI with error message
      showDebugUI('No project found for this domain');
    }
  });
}

/**
 * Hides the floating UI if it exists
 */
function hideFloatingUI() {
  console.log('Hiding floating UI');
  if (envSwitcherUI) {
    envSwitcherUI.hide();
  }
}

/**
 * Shows a minimal debug UI with optional message
 */
function showDebugUI(message = '') {
  console.log('Showing debug UI:', message);
  if (!envSwitcherUI) {
    envSwitcherUI = new EnvironmentSwitcherUI();
  }
  
  envSwitcherUI.showDebugUI(message);
}

// Run this after loading htmx
if (typeof htmx === 'undefined') {
  console.log('Reloading htmx');
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('htmx.min.js');
  document.head.appendChild(script);
} 