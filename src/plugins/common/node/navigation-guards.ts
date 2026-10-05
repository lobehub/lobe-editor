import type { LexicalEditor } from 'lexical';

/**
 * Shared keyboard ownership guard for structural navigation. Shift remains
 * available to callers that implement range expansion; platform modifiers,
 * composition, read-only editors, and already-consumed events pass through to
 * the owner that originally handled them.
 */
export function shouldHandleNavigationEvent(
  editor: LexicalEditor,
  event: KeyboardEvent,
  allowShift = false,
): boolean {
  if (
    event.defaultPrevented ||
    event.isComposing ||
    editor.isComposing() ||
    !editor.isEditable() ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  ) {
    return false;
  }
  return allowShift || !event.shiftKey;
}
