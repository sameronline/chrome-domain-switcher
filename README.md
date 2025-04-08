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