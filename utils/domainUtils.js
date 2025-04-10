/**
 * Domain utility functions for Environment Switcher
 */

/**
 * Checks if a hostname matches a domain pattern with wildcard support
 * @param {string} hostname - The hostname to check
 * @param {string} pattern - The pattern to match against (can include * wildcard)
 * @returns {boolean} - True if the hostname matches the pattern
 */
export function matchesDomain(hostname, pattern) {
  // If the pattern contains a wildcard
  if (pattern.includes('*')) {
    // Convert the wildcard pattern to a regular expression
    // Escape special regex characters but keep * as wildcard
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
      .replace(/\*/g, '.*'); // Replace * with .*
    
    // Create a regular expression from the pattern
    const regex = new RegExp(`^${regexPattern}$`);
    
    // Test if the hostname matches the pattern
    return regex.test(hostname);
  }
  
  // No wildcard, do a direct comparison
  return hostname === pattern;
}

/**
 * Extract domain value from a domain entry (which might be a string or object)
 * @param {string|Object} domainEntry - The domain entry
 * @returns {string} - The domain value
 */
export function getDomainValue(domainEntry) {
  return typeof domainEntry === 'string' ? domainEntry : domainEntry.domain;
}

/**
 * Extract the wildcard portion from a full domain using a wildcard pattern
 * @param {string} fullDomain - The full domain
 * @param {string} wildcardPattern - The wildcard pattern
 * @returns {string} - The extracted portion
 */
export function extractWildcardPortion(fullDomain, wildcardPattern) {
  // If pattern is *-something.com, extract the part that matches *
  if (wildcardPattern.startsWith('*')) {
    const suffix = wildcardPattern.substring(1); // Remove the '*'
    if (fullDomain.endsWith(suffix)) {
      return fullDomain.substring(0, fullDomain.length - suffix.length);
    }
  }
  // If pattern is something.*.com, more complex logic would be needed
  // For now returning full domain as fallback
  return fullDomain;
}

/**
 * Parse a URL into components
 * @param {string} url - The URL to parse
 * @returns {Object} - The parsed URL components
 */
export function parseUrl(url) {
  try {
    const urlObj = new URL(url);
    return {
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search + urlObj.hash,
      valid: true
    };
  } catch (e) {
    console.error('Error parsing URL:', e);
    return { valid: false };
  }
}

/**
 * Build URL with selected domain and protocol
 * @param {string} domain - The domain
 * @param {string} protocol - The protocol
 * @param {string} path - The path
 * @param {Array} protocolRules - Protocol rules array
 * @returns {string} - The built URL
 */
export function buildUrl(domain, protocol, path, protocolRules) {
  // Force protocol if needed
  const forcedProtocol = getForcedProtocol(domain, protocolRules);
  const finalProtocol = forcedProtocol || protocol;
  
  return `${finalProtocol}//${domain}${path}`;
}

/**
 * Check if domain has a forced protocol
 * @param {string} domain - The domain to check
 * @param {Array} protocolRules - The protocol rules array
 * @returns {string|null} - The forced protocol or null
 */
export function getForcedProtocol(domain, protocolRules) {
  for (const rule of protocolRules) {
    if (!rule.includes('|')) continue;
    
    const [pattern, protocol] = rule.split('|');
    const trimmedPattern = pattern.trim();
    const trimmedProtocol = protocol.trim();
    
    if (matchesDomain(domain, trimmedPattern)) {
      return trimmedProtocol + ':';
    }
  }
  return null;
} 