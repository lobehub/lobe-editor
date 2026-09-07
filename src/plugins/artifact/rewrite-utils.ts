import { DOMParser } from '@xmldom/xmldom';

export const normalizeArtifactTitle = (value: string): string => value.replace(/\s+/gu, ' ').trim();

/** Extract a decoded, normalized HTML <title> without regex-parsing markup. */
export const extractArtifactTitle = (html: string): string | undefined => {
  const document = new DOMParser({ onError: () => undefined }).parseFromString(html, 'text/html');
  const titleElement = document.getElementsByTagName('title')[0];
  const title = normalizeArtifactTitle(titleElement?.textContent || '');
  return title || undefined;
};
