// Re-export shared URL validation from utils
export { isValidUrl } from '@/utils/url';

// URL validation regex that matches common URL patterns for extraction
const urlRegExp = new RegExp(
  /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\w$&+,:;=-]+@)?[\d.A-Za-z-]+|(?:www.|[\w$&+,:;=-]+@)[\d.A-Za-z-]+)((?:\/[%+./~\w-_]*)?\??[\w%&+.;=@-]*#?\w*)?)/,
);

/**
 * Sanitizes a URL to ensure it's safe to use
 * @param url - The URL to sanitize
 * @returns The sanitized URL
 */
export function sanitizeUrl(url: string): string {
  const SUPPORTED_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'sms:', 'tel:']);

  try {
    const parsedUrl = new URL(url);
    if (!SUPPORTED_URL_PROTOCOLS.has(parsedUrl.protocol)) {
      return 'about:blank';
    }
  } catch {
    return url;
  }
  return url;
}

/**
 * Extracts URL from text
 * @param text - The text to extract URL from
 * @returns The extracted URL information or null
 */
export function extractUrlFromText(
  text: string,
): { index: number; length: number; url: string } | null {
  const match = urlRegExp.exec(text);
  if (!match) return null;
  const raw = match[0];
  const start = (match as any).index ?? text.indexOf(raw);
  // Trim trailing punctuation that often follows inline links
  const trimmed = raw.replace(/[)\],.;:]+$/u, '');
  return { index: start, length: trimmed.length, url: trimmed };
}
