/**
 * Scroll the current selection into view, centered vertically in the viewport
 * @param offsetY Optional vertical offset from center (default: 0)
 */
export function scrollIntoView(offsetY: number = 0) {
  // Skip on server side
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  // If selection has no visible rect, try to get it from the focus node
  if (rect.height === 0 && rect.width === 0) {
    const focusNode = selection.focusNode;
    if (focusNode) {
      const element =
        focusNode.nodeType === Node.ELEMENT_NODE
          ? (focusNode as HTMLElement)
          : focusNode.parentElement;

      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    return;
  }

  // Calculate the center position of the selection
  const selectionCenter = rect.top + rect.height / 2;
  const viewportCenter = window.innerHeight / 2;

  // Calculate scroll amount needed to center the selection
  const scrollAmount = selectionCenter - viewportCenter + offsetY;

  // Perform smooth scroll
  window.scrollBy({
    behavior: 'smooth',
    top: scrollAmount,
  });
}
