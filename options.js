document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const projectsContainer = document.getElementById('projects-container');
  const newProjectInput = document.getElementById('new-project');
  const addProjectButton = document.getElementById('add-project');
  const protocolRulesTextarea = document.getElementById('protocol-rules');
  const showProtocolCheckbox = document.getElementById('show-protocol');
  const autoCollapseCheckbox = document.getElementById('auto-collapse');
  const incognitoModeCheckbox = document.getElementById('incognito-mode');
  const saveButton = document.getElementById('save');
  const resetButton = document.getElementById('reset');
  
  // Default settings
  const defaultSettings = {
    projects: [
      {
        name: "Example Project",
        domains: [
          { domain: "dev.example.com", label: "Development" },
          { domain: "stage.example.com", label: "Staging" },
          { domain: "www.example.com", label: "Production" }
        ],
        floatingEnabled: false,
        tools: []
      }
    ],
    protocolRules: [
      '*.dev.example.com|https',
      '*.stage.example.com|https'
    ],
    detectors: {
    },
    showProtocol: true,
    autoCollapse: true,
    incognitoMode: false
  };
  
  // Current settings
  let projects = [];
  let protocolRules = [];
  let incognitoMode = false;
  
  // Load settings when page loads
  function loadSettings() {
    chrome.storage.sync.get({
      projects: defaultSettings.projects,
      protocolRules: defaultSettings.protocolRules,
      detectors: defaultSettings.detectors,
      showProtocol: defaultSettings.showProtocol,
      autoCollapse: defaultSettings.autoCollapse,
      incognitoMode: defaultSettings.incognitoMode
    }, function(items) {
      projects = items.projects;
      protocolRules = items.protocolRules;
      incognitoMode = items.incognitoMode;
      
      // Make sure all projects have a tools property
      projects.forEach(project => {
        if (!project.tools) {
          project.tools = [];
        }
      });
      
      // Update UI with loaded settings
      updateProjectsUI();
      protocolRulesTextarea.value = protocolRules.join('\n');
      
      showProtocolCheckbox.checked = items.showProtocol;
      autoCollapseCheckbox.checked = items.autoCollapse;
      incognitoModeCheckbox.checked = items.incognitoMode;
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
      
      // Project settings
      const projectSettings = document.createElement('div');
      projectSettings.className = 'project-settings';
      
      // Floating UI toggle
      const floatingToggleLabel = document.createElement('label');
      floatingToggleLabel.className = 'toggle-label';
      
      const floatingToggleCheckbox = document.createElement('input');
      floatingToggleCheckbox.type = 'checkbox';
      floatingToggleCheckbox.checked = project.floatingEnabled === true;
      floatingToggleCheckbox.addEventListener('change', function() {
        projects[projectIndex].floatingEnabled = this.checked;
      });
      
      floatingToggleLabel.appendChild(floatingToggleCheckbox);
      floatingToggleLabel.appendChild(document.createTextNode(' Enable floating UI for this project'));
      
      projectSettings.appendChild(floatingToggleLabel);
      projectDiv.appendChild(projectSettings);
      
      // Domain list
      const domainsHeader = document.createElement('h4');
      domainsHeader.textContent = 'Domains';
      domainsHeader.className = 'domain-header';
      projectDiv.appendChild(domainsHeader);
      
      const domainsDiv = document.createElement('div');
      domainsDiv.className = 'domain-list';
      
      // Ensure domains array is properly formatted
      if (!project.domains) {
        project.domains = [];
      }
      
      project.domains.forEach(function(domainEntry, domainIndex) {
        const domainItem = document.createElement('div');
        domainItem.className = 'domain-item';
        
        // Handle both string domains and domain objects
        const domainValue = typeof domainEntry === 'string' ? domainEntry : domainEntry.domain;
        const labelValue = typeof domainEntry === 'string' ? '' : (domainEntry.label || '');
        
        const domainText = document.createElement('span');
        if (labelValue) {
          domainText.innerHTML = `<strong>${labelValue}</strong> (${domainValue})`;
        } else {
          domainText.textContent = domainValue;
        }
        domainItem.appendChild(domainText);
        
        // Edit button
        const editButton = document.createElement('button');
        editButton.className = 'domain-edit-button';
        editButton.textContent = 'Edit';
        editButton.addEventListener('click', function() {
          // Create a formatted domain object
          const currentDomain = typeof domainEntry === 'string' 
            ? { domain: domainEntry, label: '' }
            : { ...domainEntry };
          
          // Edit domain dialog
          editDomainDialog(projectIndex, domainIndex, currentDomain);
        });
        domainItem.appendChild(editButton);
        
        // Remove button
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-button';
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
      newDomainInput.className = 'domain-input';
      newDomainInput.placeholder = 'Enter domain (e.g., example.com)';
      addDomainForm.appendChild(newDomainInput);
      
      const newLabelInput = document.createElement('input');
      newLabelInput.type = 'text';
      newLabelInput.className = 'label-input';
      newLabelInput.placeholder = 'Label (optional)';
      addDomainForm.appendChild(newLabelInput);
      
      const addDomainButton = document.createElement('button');
      addDomainButton.textContent = 'Add Domain';
      addDomainButton.addEventListener('click', function() {
        const domain = newDomainInput.value.trim();
        const label = newLabelInput.value.trim();
        
        if (domain) {
          addDomainToProject(projectIndex, domain, label);
          newDomainInput.value = '';
          newLabelInput.value = '';
          updateProjectsUI();
        } else {
          alert('Please enter a valid domain');
        }
      });
      addDomainForm.appendChild(addDomainButton);
      
      domainsDiv.appendChild(addDomainForm);
      projectDiv.appendChild(domainsDiv);
      
      // Tools section
      const toolsHeader = document.createElement('h4');
      toolsHeader.textContent = 'Tools';
      toolsHeader.className = 'domain-header';
      projectDiv.appendChild(toolsHeader);
      
      const toolsDiv = document.createElement('div');
      toolsDiv.className = 'tools-list';
      
      // Ensure tools array exists
      if (!project.tools) {
        project.tools = [];
      }
      
      // Display tools
      project.tools.forEach(function(tool, toolIndex) {
        const toolItem = document.createElement('div');
        toolItem.className = 'domain-item';
        
        const toolText = document.createElement('span');
        toolText.innerHTML = `<strong>${tool.label}</strong> (${tool.url})`;
        toolItem.appendChild(toolText);
        
        // Edit button
        const editButton = document.createElement('button');
        editButton.className = 'domain-edit-button';
        editButton.textContent = 'Edit';
        editButton.addEventListener('click', function() {
          editToolDialog(projectIndex, toolIndex, {...tool});
        });
        toolItem.appendChild(editButton);
        
        // Remove button
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-button';
        removeButton.textContent = 'Remove';
        removeButton.addEventListener('click', function() {
          projects[projectIndex].tools.splice(toolIndex, 1);
          updateProjectsUI();
        });
        toolItem.appendChild(removeButton);
        
        toolsDiv.appendChild(toolItem);
      });
      
      // Add tool form
      const addToolForm = document.createElement('div');
      addToolForm.className = 'add-domain-form';
      
      const newToolUrlInput = document.createElement('input');
      newToolUrlInput.type = 'text';
      newToolUrlInput.className = 'domain-input';
      newToolUrlInput.placeholder = 'Enter tool URL';
      addToolForm.appendChild(newToolUrlInput);
      
      const newToolLabelInput = document.createElement('input');
      newToolLabelInput.type = 'text';
      newToolLabelInput.className = 'label-input';
      newToolLabelInput.placeholder = 'Tool Label';
      addToolForm.appendChild(newToolLabelInput);
      
      const addToolButton = document.createElement('button');
      addToolButton.textContent = 'Add Tool';
      addToolButton.addEventListener('click', function() {
        const url = newToolUrlInput.value.trim();
        const label = newToolLabelInput.value.trim();
        
        if (url && label) {
          addToolToProject(projectIndex, url, label);
          newToolUrlInput.value = '';
          newToolLabelInput.value = '';
          updateProjectsUI();
        } else {
          alert('Please enter both URL and label for the tool');
        }
      });
      addToolForm.appendChild(addToolButton);
      
      toolsDiv.appendChild(addToolForm);
      projectDiv.appendChild(toolsDiv);
      
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
  
  // Edit domain dialog
  function editDomainDialog(projectIndex, domainIndex, domainObj) {
    // Create a dialog for editing domain
    const dialog = document.createElement('div');
    dialog.className = 'dialog-overlay';
    
    const dialogContent = document.createElement('div');
    dialogContent.className = 'dialog-content';
    
    const dialogTitle = document.createElement('h3');
    dialogTitle.className = 'dialog-title';
    dialogTitle.textContent = 'Edit Domain';
    dialogContent.appendChild(dialogTitle);
    
    // Domain input
    const domainGroup = document.createElement('div');
    domainGroup.className = 'form-group';
    
    const domainLabel = document.createElement('label');
    domainLabel.className = 'form-label';
    domainLabel.textContent = 'Domain:';
    domainGroup.appendChild(domainLabel);
    
    const domainInput = document.createElement('input');
    domainInput.className = 'form-input';
    domainInput.type = 'text';
    domainInput.value = domainObj.domain;
    domainGroup.appendChild(domainInput);
    
    dialogContent.appendChild(domainGroup);
    
    // Label input
    const labelGroup = document.createElement('div');
    labelGroup.className = 'form-group';
    
    const labelDomainLabel = document.createElement('label');
    labelDomainLabel.className = 'form-label';
    labelDomainLabel.textContent = 'Label (display name):';
    labelGroup.appendChild(labelDomainLabel);
    
    const labelInput = document.createElement('input');
    labelInput.className = 'form-input';
    labelInput.type = 'text';
    labelInput.value = domainObj.label || '';
    labelGroup.appendChild(labelInput);
    
    dialogContent.appendChild(labelGroup);
    
    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';
    
    // Cancel button
    const cancelButton = document.createElement('button');
    cancelButton.className = 'button button-cancel';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', function() {
      document.body.removeChild(dialog);
    });
    buttonContainer.appendChild(cancelButton);
    
    // Save button
    const saveButton = document.createElement('button');
    saveButton.className = 'button button-save';
    saveButton.textContent = 'Save';
    saveButton.addEventListener('click', function() {
      const domain = domainInput.value.trim();
      const label = labelInput.value.trim();
      
      if (!domain) {
        alert('Domain cannot be empty');
        return;
      }
      
      // Check if domain exists elsewhere in this project
      const exists = projects[projectIndex].domains.some((entry, idx) => {
        const domainVal = typeof entry === 'string' ? entry : entry.domain;
        return domainVal === domain && idx !== domainIndex;
      });
      
      if (exists) {
        alert('This domain already exists in the project');
        return;
      }
      
      // Update domain entry
      projects[projectIndex].domains[domainIndex] = label 
        ? { domain: domain, label: label }
        : domain;
      
      // Sort domains
      sortDomains(projectIndex);
      
      // Update UI
      updateProjectsUI();
      
      // Close dialog
      document.body.removeChild(dialog);
    });
    buttonContainer.appendChild(saveButton);
    
    dialogContent.appendChild(buttonContainer);
    dialog.appendChild(dialogContent);
    
    document.body.appendChild(dialog);
  }
  
  // Edit tool dialog
  function editToolDialog(projectIndex, toolIndex, toolObj) {
    // Create dialog container
    const dialogContainer = document.createElement('div');
    dialogContainer.className = 'dialog-overlay';
    
    // Create dialog content
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialogContainer.appendChild(dialog);
    
    // Dialog header
    const dialogHeader = document.createElement('div');
    dialogHeader.className = 'dialog-header';
    dialogHeader.textContent = 'Edit Tool';
    dialog.appendChild(dialogHeader);
    
    // Close button
    const closeButton = document.createElement('button');
    closeButton.className = 'dialog-close';
    closeButton.textContent = '×';
    closeButton.addEventListener('click', function() {
      document.body.removeChild(dialogContainer);
    });
    dialogHeader.appendChild(closeButton);
    
    // Dialog content
    const dialogContent = document.createElement('div');
    dialogContent.className = 'dialog-content';
    dialog.appendChild(dialogContent);
    
    // URL field
    const urlLabel = document.createElement('label');
    urlLabel.textContent = 'URL:';
    urlLabel.setAttribute('for', 'edit-tool-url');
    dialogContent.appendChild(urlLabel);
    
    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.id = 'edit-tool-url';
    urlInput.value = toolObj.url || '';
    dialogContent.appendChild(urlInput);
    
    // Label field
    const labelLabel = document.createElement('label');
    labelLabel.textContent = 'Label:';
    labelLabel.setAttribute('for', 'edit-tool-label');
    dialogContent.appendChild(labelLabel);
    
    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.id = 'edit-tool-label';
    labelInput.value = toolObj.label || '';
    dialogContent.appendChild(labelInput);
    
    // Dialog buttons
    const dialogButtons = document.createElement('div');
    dialogButtons.className = 'dialog-buttons';
    dialog.appendChild(dialogButtons);
    
    // Cancel button
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', function() {
      document.body.removeChild(dialogContainer);
    });
    dialogButtons.appendChild(cancelButton);
    
    // Save button
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.className = 'primary-button';
    saveButton.addEventListener('click', function() {
      const url = urlInput.value.trim();
      const label = labelInput.value.trim();
      
      if (url && label) {
        projects[projectIndex].tools[toolIndex] = {
          url: url,
          label: label
        };
        updateProjectsUI();
        document.body.removeChild(dialogContainer);
      } else {
        alert('Please enter both URL and label for the tool');
      }
    });
    dialogButtons.appendChild(saveButton);
    
    // Show dialog
    document.body.appendChild(dialogContainer);
    
    // Focus first input
    urlInput.focus();
  }
  
  // Sort domains in a project
  function sortDomains(projectIndex) {
    if (!projects[projectIndex].domains) return;
    
    projects[projectIndex].domains.sort((a, b) => {
      const domainA = typeof a === 'string' ? a : a.domain;
      const domainB = typeof b === 'string' ? b : b.domain;
      return domainA.localeCompare(domainB);
    });
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
      domains: [],
      tools: [],
      floatingEnabled: false
    });
    
    updateProjectsUI();
    newProjectInput.value = '';
  }
  
  // Add a domain to a project
  function addDomainToProject(projectIndex, domain, label) {
    // Validate domain
    if (!domain) {
      alert('Please enter a domain');
      return;
    }
    
    // Remove http/https protocol if present
    domain = domain.replace(/^https?:\/\//, '');
    
    // Validate domain isn't already in the project
    const exists = projects[projectIndex].domains.some(entry => {
      const domainValue = typeof entry === 'string' ? entry : entry.domain;
      return domainValue === domain;
    });
    
    if (exists) {
      alert('This domain is already in the project');
      return;
    }
    
    // Add domain to the project, with label if provided
    if (label) {
      projects[projectIndex].domains.push({ domain: domain, label: label });
    } else {
      projects[projectIndex].domains.push(domain);
    }
    
    // Sort domains
    sortDomains(projectIndex);
    
    // Update UI
    updateProjectsUI();
  }
  
  // Add a tool to a project
  function addToolToProject(projectIndex, url, label) {
    if (!url) return;
    
    try {
      // Validate URL by trying to construct URL object
      new URL(url);
      
      // Check if the tool already exists in this project
      const exists = projects[projectIndex].tools.some(t => t.url === url);
      if (exists) {
        alert(`A tool with this URL already exists in this project`);
        return;
      }
      
      // Add the tool to the project
      projects[projectIndex].tools.push({
        url: url,
        label: label || url
      });
      
      return true;
    } catch (e) {
      // Invalid URL
      alert('Please enter a valid URL (include http:// or https://)');
      return false;
    }
  }
  
  // Save settings to chrome.storage
  function saveSettings() {
    // Parse protocol rules
    const parsedRules = protocolRulesTextarea.value
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && line.includes('|'));
    
    // Get UI settings
    const showProtocol = showProtocolCheckbox.checked;
    const autoCollapse = autoCollapseCheckbox.checked;
    const incognitoMode = incognitoModeCheckbox.checked;
    
    // Ensure each project has the tools array
    projects.forEach(project => {
      if (!project.tools) {
        project.tools = [];
      }
    });
    
    // Save all settings
    chrome.storage.sync.set({
      projects: projects,
      protocolRules: parsedRules,
      showProtocol: showProtocol,
      autoCollapse: autoCollapse,
      incognitoMode: incognitoMode
    }, function() {
      // Show saved message
      const saveStatus = document.createElement('div');
      saveStatus.className = 'save-status';
      saveStatus.textContent = 'Settings saved!';
      document.body.appendChild(saveStatus);
      
      // Remove the message after a delay
      setTimeout(function() {
        if (saveStatus.parentNode) {
          document.body.removeChild(saveStatus);
        }
      }, 1500);
    });
  }
  
  // Reset settings to defaults
  function resetSettings() {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      // Set variables to defaults
      projects = JSON.parse(JSON.stringify(defaultSettings.projects));
      protocolRules = [...defaultSettings.protocolRules];
      
      // Ensure each project has a tools array
      projects.forEach(project => {
        if (!project.tools) {
          project.tools = [];
        }
      });
      
      // Update UI with default settings
      updateProjectsUI();
      protocolRulesTextarea.value = protocolRules.join('\n');
      
      showProtocolCheckbox.checked = defaultSettings.showProtocol;
      autoCollapseCheckbox.checked = defaultSettings.autoCollapse;
      incognitoModeCheckbox.checked = defaultSettings.incognitoMode;
      
      // Save defaults to storage
      saveSettings();
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