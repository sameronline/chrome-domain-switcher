/**
 * Options script for Environment Switcher
 */

import { getSettings, saveSettings, DEFAULT_SETTINGS, STORAGE_KEYS } from './services/storageService.js';
import { createElement, showToast } from './utils/uiUtils.js';
import { getDomainValue } from './utils/domainUtils.js';

// DOM elements
const projectsContainer = document.getElementById('projects-container');
const newProjectInput = document.getElementById('new-project');
const addProjectButton = document.getElementById('add-project');
const protocolRulesTextarea = document.getElementById('protocol-rules');
const showProtocolCheckbox = document.getElementById('show-protocol');
const autoCollapseCheckbox = document.getElementById('auto-collapse');
const autoRedirectCheckbox = document.getElementById('auto-redirect');
const incognitoModeCheckbox = document.getElementById('incognito-mode');
const saveButton = document.getElementById('save');
const resetButton = document.getElementById('reset');
const dialogContainer = document.getElementById('dialog-container');

// Current settings
let projects = [];
let protocolRules = [];
let showProtocol = true;
let autoCollapse = true;
let autoRedirect = true;
let incognitoMode = false;

/**
 * Initialize the options page
 */
function init() {
  // Load settings
  loadSettings();
  
  // Add event listeners
  addEventListeners();
}

/**
 * Load settings from storage
 */
function loadSettings() {
  getSettings((settings) => {
    projects = settings[STORAGE_KEYS.PROJECTS];
    protocolRules = settings[STORAGE_KEYS.PROTOCOL_RULES];
    showProtocol = settings[STORAGE_KEYS.SHOW_PROTOCOL];
    autoCollapse = settings[STORAGE_KEYS.AUTO_COLLAPSE];
    autoRedirect = settings[STORAGE_KEYS.AUTO_REDIRECT];
    incognitoMode = settings[STORAGE_KEYS.INCOGNITO_MODE];
    
    // Make sure all projects have a tools property
    projects.forEach(project => {
      if (!project.tools) {
        project.tools = [];
      }
    });
    
    // Update UI
    updateUI();
  });
}

/**
 * Update UI with current settings
 */
function updateUI() {
  // Update projects UI
  updateProjectsUI();
  
  // Update protocol rules
  protocolRulesTextarea.value = protocolRules.join('\n');
  
  // Update checkboxes
  showProtocolCheckbox.checked = showProtocol;
  autoCollapseCheckbox.checked = autoCollapse;
  autoRedirectCheckbox.checked = autoRedirect;
  incognitoModeCheckbox.checked = incognitoMode;
}

/**
 * Update projects UI
 */
function updateProjectsUI() {
  // Clear existing list
  projectsContainer.innerHTML = '';
  
  // Add each project to the list
  projects.forEach((project, projectIndex) => {
    const projectItem = createProjectItem(project, projectIndex);
    projectsContainer.appendChild(projectItem);
  });
}

/**
 * Create project item element
 * @param {Object} project - The project
 * @param {number} projectIndex - The project index
 * @returns {HTMLElement} - The project item element
 */
function createProjectItem(project, projectIndex) {
  const projectDiv = createElement('div', { className: 'project-item' });
  
  // Project header with name and controls
  const projectHeader = createElement('div', { className: 'project-header' });
  
  const projectName = createElement('h3', {}, project.name);
  projectHeader.appendChild(projectName);
  
  const projectControls = createElement('div', { className: 'project-controls' });
  
  // Edit button
  const editNameButton = createElement('button', {
    onclick: () => editProjectName(projectIndex)
  }, 'Edit');
  projectControls.appendChild(editNameButton);
  
  // Delete button
  const deleteProjectButton = createElement('button', {
    onclick: () => deleteProject(projectIndex)
  }, 'Delete');
  projectControls.appendChild(deleteProjectButton);
  
  projectHeader.appendChild(projectControls);
  projectDiv.appendChild(projectHeader);
  
  // Project settings
  const projectSettings = createElement('div', { className: 'project-settings' });
  
  // Floating UI toggle
  const floatingToggleLabel = createElement('label', { className: 'toggle-label' });
  
  const floatingToggleCheckbox = createElement('input', {
    type: 'checkbox',
    checked: project.floatingEnabled === true,
    onchange: () => toggleFloatingUI(projectIndex)
  });
  
  floatingToggleLabel.appendChild(floatingToggleCheckbox);
  floatingToggleLabel.appendChild(document.createTextNode(' Enable floating UI for this project'));
  
  projectSettings.appendChild(floatingToggleLabel);
  projectDiv.appendChild(projectSettings);
  
  // Domain list
  const domainsHeader = createElement('h4', { className: 'domain-header' }, 'Domains');
  projectDiv.appendChild(domainsHeader);
  
  const domainsDiv = createElement('div', { className: 'domain-list' });
  
  // Ensure domains array exists
  if (!project.domains) {
    project.domains = [];
  }
  
  // Add domain items
  project.domains.forEach((domainEntry, domainIndex) => {
    const domainItem = createDomainItem(projectIndex, domainIndex, domainEntry);
    domainsDiv.appendChild(domainItem);
  });
  
  projectDiv.appendChild(domainsDiv);
  
  // Add domain button
  const addDomainButton = createElement('button', {
    onclick: () => addDomain(projectIndex)
  }, 'Add Domain');
  
  projectDiv.appendChild(addDomainButton);
  
  return projectDiv;
}

/**
 * Create domain item element
 * @param {number} projectIndex - The project index
 * @param {number} domainIndex - The domain index
 * @param {string|Object} domainEntry - The domain entry
 * @returns {HTMLElement} - The domain item element
 */
function createDomainItem(projectIndex, domainIndex, domainEntry) {
  const domainItem = createElement('div', { className: 'domain-item' });
  
  // Handle both string domains and domain objects
  const domainValue = getDomainValue(domainEntry);
  const labelValue = typeof domainEntry === 'string' ? '' : (domainEntry.label || '');
  
  // Domain text
  const domainText = createElement('span');
  if (labelValue) {
    domainText.innerHTML = `<strong>${labelValue}</strong> (${domainValue})`;
  } else {
    domainText.textContent = domainValue;
  }
  domainItem.appendChild(domainText);
  
  // Edit button
  const editButton = createElement('button', {
    className: 'domain-edit-button',
    onclick: () => editDomain(projectIndex, domainIndex)
  }, 'Edit');
  domainItem.appendChild(editButton);
  
  // Remove button
  const removeButton = createElement('button', {
    className: 'remove-button',
    onclick: () => removeDomain(projectIndex, domainIndex)
  }, 'Remove');
  domainItem.appendChild(removeButton);
  
  return domainItem;
}

/**
 * Edit project name
 * @param {number} projectIndex - The project index
 */
function editProjectName(projectIndex) {
  const project = projects[projectIndex];
  const newName = prompt('Enter new project name:', project.name);
  
  if (newName && newName.trim()) {
    projects[projectIndex].name = newName.trim();
    updateProjectsUI();
  }
}

/**
 * Delete project
 * @param {number} projectIndex - The project index
 */
function deleteProject(projectIndex) {
  if (confirm(`Are you sure you want to delete the project "${projects[projectIndex].name}"?`)) {
    projects.splice(projectIndex, 1);
    updateProjectsUI();
  }
}

/**
 * Toggle floating UI for project
 * @param {number} projectIndex - The project index
 */
function toggleFloatingUI(projectIndex) {
  projects[projectIndex].floatingEnabled = !projects[projectIndex].floatingEnabled;
}

/**
 * Add new domain to project
 * @param {number} projectIndex - The project index
 */
function addDomain(projectIndex) {
  // Simple implementation for now
  const domain = prompt('Enter domain:');
  const label = prompt('Enter label (optional):');
  
  if (domain && domain.trim()) {
    if (label && label.trim()) {
      projects[projectIndex].domains.push({
        domain: domain.trim(),
        label: label.trim()
      });
    } else {
      projects[projectIndex].domains.push(domain.trim());
    }
    
    updateProjectsUI();
  }
}

/**
 * Edit domain
 * @param {number} projectIndex - The project index
 * @param {number} domainIndex - The domain index
 */
function editDomain(projectIndex, domainIndex) {
  const domainEntry = projects[projectIndex].domains[domainIndex];
  const currentDomain = getDomainValue(domainEntry);
  const currentLabel = typeof domainEntry === 'string' ? '' : (domainEntry.label || '');
  
  const domain = prompt('Enter domain:', currentDomain);
  const label = prompt('Enter label (optional):', currentLabel);
  
  if (domain && domain.trim()) {
    if (label && label.trim()) {
      projects[projectIndex].domains[domainIndex] = {
        domain: domain.trim(),
        label: label.trim()
      };
    } else {
      projects[projectIndex].domains[domainIndex] = domain.trim();
    }
    
    updateProjectsUI();
  }
}

/**
 * Remove domain
 * @param {number} projectIndex - The project index
 * @param {number} domainIndex - The domain index
 */
function removeDomain(projectIndex, domainIndex) {
  projects[projectIndex].domains.splice(domainIndex, 1);
  updateProjectsUI();
}

/**
 * Add new project
 */
function addProject() {
  const projectName = newProjectInput.value.trim();
  
  if (projectName) {
    projects.push({
      name: projectName,
      domains: [],
      floatingEnabled: false,
      tools: []
    });
    
    newProjectInput.value = '';
    updateProjectsUI();
  }
}

/**
 * Save settings
 */
function saveSettings() {
  // Parse protocol rules from textarea
  const parsedRules = protocolRulesTextarea.value.split('\n')
    .map(line => line.trim())
    .filter(line => line && line.includes('|'));
  
  // Create settings object
  const settings = {
    [STORAGE_KEYS.PROJECTS]: projects,
    [STORAGE_KEYS.PROTOCOL_RULES]: parsedRules,
    [STORAGE_KEYS.SHOW_PROTOCOL]: showProtocolCheckbox.checked,
    [STORAGE_KEYS.AUTO_COLLAPSE]: autoCollapseCheckbox.checked,
    [STORAGE_KEYS.AUTO_REDIRECT]: autoRedirectCheckbox.checked,
    [STORAGE_KEYS.INCOGNITO_MODE]: incognitoModeCheckbox.checked
  };
  
  // Save to storage
  saveSettings(settings, () => {
    showToast('Settings saved successfully');
  });
}

/**
 * Reset settings to defaults
 */
function resetSettings() {
  if (confirm('Are you sure you want to reset all settings to defaults?')) {
    // Reset to default settings
    projects = DEFAULT_SETTINGS.projects;
    protocolRules = DEFAULT_SETTINGS.protocolRules;
    showProtocol = DEFAULT_SETTINGS.showProtocol;
    autoCollapse = DEFAULT_SETTINGS.autoCollapse;
    autoRedirect = DEFAULT_SETTINGS.autoRedirect;
    incognitoMode = DEFAULT_SETTINGS.incognitoMode;
    
    // Update UI
    updateUI();
    
    // Show confirmation
    showToast('Settings reset to defaults');
  }
}

/**
 * Add event listeners
 */
function addEventListeners() {
  // Add project button
  addProjectButton.addEventListener('click', addProject);
  
  // Save button
  saveButton.addEventListener('click', saveSettings);
  
  // Reset button
  resetButton.addEventListener('click', resetSettings);
  
  // Checkbox events
  showProtocolCheckbox.addEventListener('change', () => {
    showProtocol = showProtocolCheckbox.checked;
  });
  
  autoCollapseCheckbox.addEventListener('change', () => {
    autoCollapse = autoCollapseCheckbox.checked;
  });
  
  autoRedirectCheckbox.addEventListener('change', () => {
    autoRedirect = autoRedirectCheckbox.checked;
  });
  
  incognitoModeCheckbox.addEventListener('change', () => {
    incognitoMode = incognitoModeCheckbox.checked;
  });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init); 