import { getDOMSelectionFromTarget } from 'lexical';

export function getDragSelection(event: DragEvent): Range | null | undefined {
  let range;
  const domSelection = getDOMSelectionFromTarget(event.target);
  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(event.clientX, event.clientY);
    // @ts-expect-error not error
  } else if (event.rangeParent && domSelection !== null) {
    // @ts-expect-error not error
    domSelection.collapse(event.rangeParent, event.rangeOffset || 0);
    range = domSelection.getRangeAt(0);
  } else {
    throw new Error(`Cannot get the selection when dragging`);
  }

  return range;
}
