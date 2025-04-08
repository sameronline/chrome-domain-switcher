document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const projectsContainer = document.getElementById('projects-container');
  const newProjectInput = document.getElementById('new-project');
  const addProjectButton = document.getElementById('add-project');
  const protocolRulesTextarea = document.getElementById('protocol-rules');
  const showProtocolCheckbox = document.getElementById('show-protocol');
  const autoCollapseCheckbox = document.getElementById('auto-collapse');
  const saveButton = document.getElementById('save');
  const resetButton = document.getElementById('reset');
  
  // Default settings
  const defaultSettings = {
    projects: [
      {
        name: "Example Project",
        domains: ["dev.example.com", "stage.example.com", "www.example.com"]
      }
    ],
    protocolRules: [
      '*.dev.example.com|https',
      '*.stage.example.com|https'
    ],
    detectors: {
    },
    showProtocol: true,
    autoCollapse: true
  };
  
  // Current settings
  let projects = [];
  let protocolRules = [];
  
  // Load settings when page loads
  function loadSettings() {
    chrome.storage.sync.get({
      projects: defaultSettings.projects,
      protocolRules: defaultSettings.protocolRules,
      detectors: defaultSettings.detectors,
      showProtocol: defaultSettings.showProtocol,
      autoCollapse: defaultSettings.autoCollapse
    }, function(items) {
      projects = items.projects;
      protocolRules = items.protocolRules;
      
      // Update UI with loaded settings
      updateProjectsUI();
      protocolRulesTextarea.value = protocolRules.join('\n');
      
      showProtocolCheckbox.checked = items.showProtocol;
      autoCollapseCheckbox.checked = items.autoCollapse;
    });
  }
  
  // Update the projects UI
  function updateProjectsUI() {
    // Clear existing list
    projectsContainer.innerHTML = '';
    
    // Add each project to the list
    projects.forEach(function(project, projectIndex) {
      const projectDiv = document.createElement('div');
      projectDiv.className = 'project-item';
      
      // Project name with edit/delete controls
      const projectHeader = document.createElement('div');
      projectHeader.className = 'project-header';
      
      const projectName = document.createElement('h3');
      projectName.textContent = project.name;
      projectHeader.appendChild(projectName);
      
      const projectControls = document.createElement('div');
      projectControls.className = 'project-controls';
      
      const editNameButton = document.createElement('button');
      editNameButton.textContent = 'Edit';
      editNameButton.addEventListener('click', function() {
        const newName = prompt('Enter new project name:', project.name);
        if (newName && newName.trim()) {
          projects[projectIndex].name = newName.trim();
          updateProjectsUI();
        }
      });
      projectControls.appendChild(editNameButton);
      
      const deleteProjectButton = document.createElement('button');
      deleteProjectButton.textContent = 'Delete';
      deleteProjectButton.addEventListener('click', function() {
        if (confirm(`Are you sure you want to delete the project "${project.name}"?`)) {
          projects.splice(projectIndex, 1);
          updateProjectsUI();
        }
      });
      projectControls.appendChild(deleteProjectButton);
      
      projectHeader.appendChild(projectControls);
      projectDiv.appendChild(projectHeader);
      
      // Domain list
      const domainsDiv = document.createElement('div');
      domainsDiv.className = 'domain-list';
      
      project.domains.forEach(function(domain, domainIndex) {
        const domainItem = document.createElement('div');
        domainItem.className = 'domain-item';
        
        const domainText = document.createElement('span');
        domainText.textContent = domain;
        domainItem.appendChild(domainText);
        
        const removeButton = document.createElement('button');
        removeButton.textContent = 'Remove';
        removeButton.addEventListener('click', function() {
          projects[projectIndex].domains.splice(domainIndex, 1);
          updateProjectsUI();
        });
        domainItem.appendChild(removeButton);
        
        domainsDiv.appendChild(domainItem);
      });
      
      // Add domain form
      const addDomainForm = document.createElement('div');
      addDomainForm.className = 'add-domain-form';
      
      const newDomainInput = document.createElement('input');
      newDomainInput.type = 'text';
      newDomainInput.placeholder = 'Enter new domain';
      addDomainForm.appendChild(newDomainInput);
      
      const addDomainButton = document.createElement('button');
      addDomainButton.textContent = 'Add Domain';
      addDomainButton.addEventListener('click', function() {
        addDomainToProject(projectIndex, newDomainInput.value.trim());
        newDomainInput.value = '';
      });
      addDomainForm.appendChild(addDomainButton);
      
      // Add keydown event for input
      newDomainInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          addDomainToProject(projectIndex, newDomainInput.value.trim());
          newDomainInput.value = '';
        }
      });
      
      domainsDiv.appendChild(addDomainForm);
      projectDiv.appendChild(domainsDiv);
      
      projectsContainer.appendChild(projectDiv);
    });
    
    // Show a message if no projects are configured
    if (projects.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'empty-message';
      emptyMessage.textContent = 'No projects configured. Add a project below.';
      projectsContainer.appendChild(emptyMessage);
    }
  }
  
  // Add a new project
  function addProject(projectName) {
    if (!projectName) {
      alert('Please enter a project name');
      return;
    }
    
    // Check if project name already exists
    if (projects.some(p => p.name === projectName)) {
      alert('A project with this name already exists');
      return;
    }
    
    projects.push({
      name: projectName,
      domains: []
    });
    
    updateProjectsUI();
    newProjectInput.value = '';
  }
  
  // Add a domain to a project
  function addDomainToProject(projectIndex, domain) {
    // Validate domain
    if (!domain) {
      alert('Please enter a domain');
      return;
    }
    
    // Remove http/https protocol if present
    domain = domain.replace(/^https?:\/\//, '');
    
    // Validate domain isn't already in the project
    if (projects[projectIndex].domains.includes(domain)) {
      alert('This domain is already in the project');
      return;
    }
    
    // Add domain to the project
    projects[projectIndex].domains.push(domain);
    
    // Sort domains alphabetically
    projects[projectIndex].domains.sort();
    
    // Update UI
    updateProjectsUI();
  }
  
  // Save all settings
  function saveSettings() {
    // Parse protocol rules from textarea
    const rawProtocolRules = protocolRulesTextarea.value.trim();
    protocolRules = rawProtocolRules ? rawProtocolRules.split('\n').map(rule => rule.trim()) : [];
    
    // Remove empty rules
    protocolRules = protocolRules.filter(rule => rule);
    
    // Validate protocol rules format
    const invalidRules = protocolRules.filter(rule => {
      const parts = rule.split('|');
      return parts.length !== 2 || !['http', 'https'].includes(parts[1].trim());
    });
    
    if (invalidRules.length > 0) {
      alert('Some protocol rules are invalid. Please use the format pattern|protocol with http or https as the protocol.');
      return;
    }
    
    // Save settings to chrome.storage.sync
    chrome.storage.sync.set({
      projects: projects,
      protocolRules: protocolRules,
      detectors: {
      },
      showProtocol: showProtocolCheckbox.checked,
      autoCollapse: autoCollapseCheckbox.checked
    }, function() {
      // Show saved message
      const saveButton = document.getElementById('save');
      const originalText = saveButton.textContent;
      saveButton.textContent = 'Settings Saved!';
      setTimeout(function() {
        saveButton.textContent = originalText;
      }, 2000);
    });
  }
  
  // Reset settings to defaults
  function resetSettings() {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      projects = defaultSettings.projects;
      protocolRules = defaultSettings.protocolRules;
      
      updateProjectsUI();
      protocolRulesTextarea.value = protocolRules.join('\n');
      
      showProtocolCheckbox.checked = defaultSettings.showProtocol;
      autoCollapseCheckbox.checked = defaultSettings.autoCollapse;
    }
  }
  
  // Event listeners
  addProjectButton.addEventListener('click', function() {
    addProject(newProjectInput.value.trim());
  });
  
  newProjectInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      addProject(newProjectInput.value.trim());
    }
  });
  
  saveButton.addEventListener('click', saveSettings);
  resetButton.addEventListener('click', resetSettings);
  
  // Initialize the page
  loadSettings();
}); 