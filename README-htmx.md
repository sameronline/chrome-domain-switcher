# Environment Switcher with htmx

This version of the Environment Switcher Chrome extension uses [htmx](https://htmx.org/) to build the floating UI. The htmx implementation offers several advantages over the traditional JavaScript approach:

- Simplified DOM manipulation - UI updates are declarative rather than imperative
- Cleaner separation of concerns - UI structure defined in HTML templates
- Reduced JavaScript code - less client-side logic
- Enhanced maintainability - easier to understand and modify

## How it Works

### Emulating a Server in a Chrome Extension

Since htmx is designed for client-server communication, we've created a custom htmx extension (`htmx-chrome-ext.js`) that emulates a server within the Chrome extension. This extension:

1. Intercepts htmx requests
2. Forwards them to the background script using Chrome messaging
3. Returns the response to htmx for UI updates

### Components

The htmx implementation consists of several key files:

- `floating-ui.html` - HTML template for the UI with htmx attributes
- `htmx-chrome-ext.js` - Custom htmx extension to handle Chrome messaging
- `content-htmx.js` - Content script that loads and initializes the UI
- `background-htmx.js` - Background script that processes htmx requests and generates responses

### Request Flow

When a user interacts with the UI:

1. htmx triggers a request via an attribute (e.g., `hx-post="chrome-ext:/toggle-collapse"`)
2. The custom extension intercepts this request and sends a message to the background script
3. The background script processes the request and generates an HTML response
4. The custom extension receives the response and updates the UI using htmx's swap mechanism

## htmx Attributes Used

The implementation uses several htmx attributes:

- `hx-post` - Send POST requests to endpoints
- `hx-target` - Specify the element to update with the response
- `hx-swap` - Control how the response is inserted into the page
- `hx-trigger` - Define when requests are triggered
- `hx-vals` - Pass additional values with requests
- `hx-include` - Include values from other elements in requests

## Installation and Testing

To test the htmx version:

1. Rename `manifest-htmx.json` to `manifest.json`
2. Load the extension as an unpacked extension in Chrome
3. Visit a website and enable the floating UI through the extension popup

## Benefits Over the Original Implementation

- **Code reduction**: Approximately 30% less JavaScript code
- **Improved maintainability**: UI changes are easier to implement
- **Better separation of concerns**: HTML structure is defined in templates
- **More declarative**: UI behavior is defined through attributes rather than event listeners
- **Enhanced resilience**: Less prone to DOM manipulation errors

## Future Improvements

- Add error handling for failed requests
- Implement loading indicators for long-running operations
- Add animations for UI transitions using htmx's classes
- Create custom components using htmx's extension mechanism 