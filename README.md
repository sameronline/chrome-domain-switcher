# Environment Switcher Chrome Extension

A Chrome extension that allows you to easily switch between different environments while preserving your current path.

## Features

- Quick domain switching with auto-redirect
- Protocol switching (HTTP/HTTPS)
- Protocol rules for specific domains
- Copy path and URL functionality
- Floating UI for easy access
- Persistent preferences

## Installation

### From Chrome Web Store

*(Coming soon)*

### Manual Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" using the toggle in the top-right corner
4. Click "Load unpacked" and select the `chrome-env-switcher` directory
5. The extension will be installed and appear in your extensions list

## Usage

### Popup Interface

Click the extension icon in your browser toolbar to open the popup interface:

- Select a domain from the dropdown or configure domains in settings
- Toggle between HTTP and HTTPS if needed
- Use the "Go" button to navigate (only visible if auto-redirect is disabled)
- Copy the current path or full URL using the copy buttons
- Access configuration settings via the "Configure Domains" button
- Enable/disable the floating UI with the toggle button

### Floating UI

When enabled, a small floating interface appears on web pages:

- Click the circular button to expand/collapse the interface
- Select domains and protocols directly from the page
- Navigate between environments without opening the popup

### Configuration

Access the configuration page by clicking "Configure Domains" in the popup:

- Add or remove domains
- Set up protocol rules (e.g., force HTTPS for specific domains)
- Adjust UI settings

## Privacy and Permissions

This extension requires the following permissions:

- `storage`: To save your preferences
- `tabs`: To access the current tab's URL and navigate
- `clipboardWrite`: To copy URLs to clipboard
- `activeTab`: To interact with the current tab
- `<all_urls>`: To inject the floating UI on web pages

No data is sent to remote servers; all settings are stored locally in your browser.

## License

MIT 

## Code Structure

The extension has been completely refactored with a modular, well-organized structure:

```
chrome-env-switcher/
├── manifest.json          # Extension manifest
├── background.js          # Background script (service worker)
├── content.js             # Content script injected into pages
├── popup.js               # Popup script
├── popup.html             # Popup HTML
├── options.js             # Options page script
├── options.html           # Options page HTML
├── components/            # UI components
│   └── FloatingUI.js      # Floating UI component
├── services/              # Service modules
│   ├── storageService.js  # Storage operations
│   └── navigationService.js # Navigation and URL handling
├── styles/                # CSS styles
│   ├── variables.css      # CSS variables and design system
│   ├── content.css        # Content script styles
│   ├── popup.css          # Popup styles
│   ├── options.css        # Options page styles
│   └── floating-ui.css    # Floating UI styles
├── utils/                 # Utility functions
│   ├── domainUtils.js     # Domain-related functions
│   └── uiUtils.js         # UI-related functions
└── icons/                 # Extension icons
```

### Key Improvements

1. **Modular Architecture**: Code separated into logical modules with clear responsibilities
2. **ES Modules**: Uses ES modules for better code organization and dependency management
3. **CSS Variables**: Consistent design system with CSS variables
4. **No Global Pollution**: All code is properly scoped to avoid global pollution
5. **Reusable Components**: UI components are reusable and self-contained
6. **Clean APIs**: Clean and consistent APIs for services and utilities

## Development

To modify or extend this extension:

1. Clone the repository
2. Make changes to the relevant modules
3. Load the extension in Chrome using "Load unpacked" in developer mode

### Adding New Features

- **New UI Component**: Add a new file in the `components/` directory
- **New Service**: Add a new file in the `services/` directory
- **New Utility**: Add a new file in the `utils/` directory 