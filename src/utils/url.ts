/**
 * Shared URL validation utilities
 */

// URL validation regex that matches common URL patterns
const URL_REGEX = new RegExp(
  /^(?:(?:https?|ftp):\/\/)?(?:www\.)?[\dA-Za-z][\w#%+./:=?@~-]*[\w#%+/=@~-]$/,
);

/**
 * Validates if a string is a valid URL
 * @param url - The URL to validate
 * @returns true if the URL is valid, false otherwise
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;

  const trimmed = url.trim();

  // Check if it matches URL pattern
  if (URL_REGEX.test(trimmed)) {
    return true;
  }

  // Check if it's a valid URL with protocol
  try {
    const urlObj = new URL(trimmed);
    return !!urlObj.protocol && !!urlObj.hostname;
  } catch {
    // Not a valid URL
  }

  // Check if it looks like a domain (e.g., "google.com")
  if (/^[\da-z][\w#%+./:=?@~-]*\.[\w#%+/:=?@~-]+$/i.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Checks if text is a pure URL (single URL without other text)
 * @param text - The text to check
 * @returns true if text is a pure URL, false otherwise
 */
export function isPureUrl(text: string): boolean {
  if (!text || typeof text !== 'string') return false;

  const trimmed = text.trim();

  // Check if it's a single line
  if (trimmed.includes('\n')) return false;

  // Check if it's a valid URL
  return isValidUrl(trimmed);
}
