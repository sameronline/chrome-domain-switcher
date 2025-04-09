/**
 * htmx-chrome-ext.js
 * 
 * A custom htmx extension that acts as a bridge between htmx and Chrome extension APIs.
 * This extension allows htmx to communicate with the background script of the Chrome extension.
 */

(function() {
  // Register the chrome-ext extension with htmx
  htmx.defineExtension('chrome-ext', {
    onEvent: function(name, evt) {
      // We only want to handle trigger events
      if (name !== 'htmx:beforeRequest') return true;
      
      // Check if the request is directed to our chrome-ext protocol
      const path = evt.detail.path;
      if (!path.startsWith('chrome-ext:/')) return true;
      
      // Prevent the default htmx Ajax request
      evt.preventDefault();
      
      // Extract the endpoint name (removing the protocol prefix)
      const endpoint = path.replace('chrome-ext:/', '');
      
      // Extract values from the triggering element
      const elt = evt.detail.elt;
      const target = htmx.getTarget(elt);
      const headers = evt.detail.headers;
      const values = htmx.values(elt);
      
      // Create a request payload for the background script
      const payload = {
        action: 'htmx',
        endpoint: endpoint,
        values: values,
        headers: headers
      };
      
      // Show the htmx request indicator
      htmx.addClass(elt, htmx.config.requestClass);
      
      // Send message to the background script
      chrome.runtime.sendMessage(payload, function(response) {
        // Remove the htmx request indicator
        htmx.removeClass(elt, htmx.config.requestClass);
        
        // Handle the response
        if (response && response.content) {
          // Process the response as if it were a normal htmx response
          const swapSpec = htmx.getSwapSpecification(elt);
          
          // Perform the content swap
          htmx.swap(target, response.content, swapSpec);
          
          // Trigger the afterRequest event
          htmx.process(target);
          
          // Trigger a custom event so that listeners know the request is complete
          htmx.trigger(elt, 'htmx:afterRequest', {
            path: path,
            success: true,
            requestConfig: evt.detail
          });
        } else if (response && response.error) {
          console.error('Chrome extension htmx error:', response.error);
          
          // Trigger error event
          htmx.trigger(elt, 'htmx:responseError', {
            error: response.error,
            path: path
          });
        }
      });
      
      // Prevent the default htmx handling
      return false;
    }
  });
})(); 