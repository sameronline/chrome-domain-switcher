document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const domainListElement = document.getElementById('domain-list');
  const newDomainInput = document.getElementById('new-domain');
  const addDomainButton = document.getElementById('add-domain');
  const protocolRulesTextarea = document.getElementById('protocol-rules');
  const showProtocolCheckbox = document.getElementById('show-protocol');
  const autoCollapseCheckbox = document.getElementById('auto-collapse');
  const saveButton = document.getElementById('save');
  const resetButton = document.getElementById('reset');
  
  // Default settings
  const defaultSettings = {
    domains: [],
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
  let domains = [];
  let protocolRules = [];
  
  // Load settings when page loads
  function loadSettings() {
    chrome.storage.sync.get({
      domains: defaultSettings.domains,
      protocolRules: defaultSettings.protocolRules,
      detectors: defaultSettings.detectors,
      showProtocol: defaultSettings.showProtocol,
      autoCollapse: defaultSettings.autoCollapse
    }, function(items) {
      domains = items.domains;
      protocolRules = items.protocolRules;
      
      // Update UI with loaded settings
      updateDomainList();
      protocolRulesTextarea.value = protocolRules.join('\n');
      
      showProtocolCheckbox.checked = items.showProtocol;
      autoCollapseCheckbox.checked = items.autoCollapse;
    });
  }
  
  // Update the domain list in the UI
  function updateDomainList() {
    // Clear existing list
    domainListElement.innerHTML = '';
    
    // Add each domain to the list
    domains.forEach(function(domain) {
      const domainItem = document.createElement('div');
      domainItem.className = 'domain-item';
      
      const domainText = document.createElement('span');
      domainText.textContent = domain;
      domainItem.appendChild(domainText);
      
      const removeButton = document.createElement('button');
      removeButton.textContent = 'Remove';
      removeButton.addEventListener('click', function() {
        removeDomain(domain);
      });
      domainItem.appendChild(removeButton);
      
      domainListElement.appendChild(domainItem);
    });
    
    // Show a message if no domains are configured
    if (domains.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'domain-item';
      emptyMessage.textContent = 'No domains configured. Add a domain below.';
      domainListElement.appendChild(emptyMessage);
    }
  }
  
  // Add a new domain to the list
  function addDomain(domain) {
    // Validate domain
    if (!domain) {
      alert('Please enter a domain');
      return;
    }
    
    // Remove http/https protocol if present
    domain = domain.replace(/^https?:\/\//, '');
    
    // Validate domain isn't already in the list
    if (domains.includes(domain)) {
      alert('This domain is already in the list');
      return;
    }
    
    // Add domain to the list
    domains.push(domain);
    
    // Sort domains alphabetically
    domains.sort();
    
    // Update UI
    updateDomainList();
    newDomainInput.value = '';
  }
  
  // Remove a domain from the list
  function removeDomain(domain) {
    domains = domains.filter(d => d !== domain);
    updateDomainList();
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
      domains: domains,
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
      domains = defaultSettings.domains;
      protocolRules = defaultSettings.protocolRules;
      
      updateDomainList();
      protocolRulesTextarea.value = protocolRules.join('\n');
      
      showProtocolCheckbox.checked = defaultSettings.showProtocol;
      autoCollapseCheckbox.checked = defaultSettings.autoCollapse;
    }
  }
  
  // Event listeners
  addDomainButton.addEventListener('click', function() {
    addDomain(newDomainInput.value.trim());
  });
  
  newDomainInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      addDomain(newDomainInput.value.trim());
    }
  });
  
  saveButton.addEventListener('click', saveSettings);
  resetButton.addEventListener('click', resetSettings);
  
  // Initialize the page
  loadSettings();
}); 