export const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';

export interface HeadingActionsPosition {
  left: number;
  top: number;
}

export function getDefaultHeadingLink(slug: string): string {
  if (typeof window === 'undefined') return `#${slug}`;
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}#${slug}`;
}

export function getHeadingActionsPosition(
  heading: HTMLElement,
  container: HTMLElement,
): HeadingActionsPosition {
  const containerRect = container.getBoundingClientRect();
  const headingRect = heading.getBoundingClientRect();
  const range = heading.ownerDocument.createRange();
  range.selectNodeContents(heading);
  const rects = typeof range.getClientRects === 'function' ? range.getClientRects() : null;
  const lastLine = rects && rects.length > 0 ? rects.item(rects.length - 1) : null;

  if (!lastLine) {
    return {
      left: headingRect.left - containerRect.left,
      top: headingRect.top - containerRect.top + headingRect.height / 2,
    };
  }

  return {
    left: lastLine.right - containerRect.left,
    top: lastLine.top - containerRect.top + lastLine.height / 2,
  };
}

export async function copyTextToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
}
