import {
  $getSelection,
  $isRangeSelection,
  LexicalEditor,
  RangeSelection,
  TextNode,
  getDOMSelection,
} from 'lexical';

/**
 * Get the text content of the editor up to the anchor point of the selection.
 * Get the text content before the anchor point of the selection
 * @param selection Selection object from Lexical editor
 * @returns
 */
export function getTextUpToAnchor(selection: RangeSelection): string | null {
  const anchor = selection.anchor;
  if (anchor.type !== 'text') {
    return null;
  }
  const anchorNode = anchor.getNode();
  if (!anchorNode.isSimpleText()) {
    return null;
  }
  const anchorOffset = anchor.offset;
  return anchorNode.getTextContent().slice(0, anchorOffset);
}

/**
 *
 * @param editor Lexical editor instance
 * Get the text content before the selection anchor point in the editor
 * @returns
 */
export function getQueryTextForSearch(editor: LexicalEditor): string | null {
  let text = null;
  editor.getEditorState().read(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
      return;
    }
    text = getTextUpToAnchor(selection);
  });
  return text;
}

export function tryToPositionRange(
  leadOffset: number,
  range: Range,
  editorWindow: Window,
): boolean {
  const domSelection = getDOMSelection(editorWindow);
  if (domSelection === null || !domSelection.isCollapsed) {
    return false;
  }
  const anchorNode = domSelection.anchorNode;
  const startOffset = leadOffset;
  const endOffset = domSelection.anchorOffset;

  if (anchorNode === null || endOffset === null) {
    return false;
  }

  try {
    range.setStart(anchorNode, startOffset);
    range.setEnd(anchorNode, endOffset);
  } catch {
    return false;
  }

  return true;
}

// Got from https://stackoverflow.com/a/42543908/2013580
export function getScrollParent(
  element: HTMLElement,
  includeHidden: boolean,
): HTMLElement | HTMLBodyElement {
  // Return element itself on server side as fallback
  if (typeof document === 'undefined') {
    return element;
  }

  let style = getComputedStyle(element);
  const excludeStaticParent = style.position === 'absolute';
  const overflowRegex = includeHidden ? /(auto|scroll|hidden)/ : /(auto|scroll)/;
  if (style.position === 'fixed') {
    return document.body;
  }
  for (let parent: HTMLElement | null = element; (parent = parent.parentElement); ) {
    style = getComputedStyle(parent);
    if (excludeStaticParent && style.position === 'static') {
      continue;
    }
    if (overflowRegex.test(style.overflow + style.overflowY + style.overflowX)) {
      return parent;
    }
  }
  return document.body;
}

export const scrollIntoViewIfNeeded = (target: HTMLElement) => {
  // Skip on server side
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const typeaheadContainerNode = document.getElementById('typeahead-menu');
  if (!typeaheadContainerNode) {
    return;
  }

  const typeaheadRect = typeaheadContainerNode.getBoundingClientRect();

  if (typeaheadRect.top + typeaheadRect.height > window.innerHeight) {
    typeaheadContainerNode.scrollIntoView({
      block: 'center',
    });
  }

  if (typeaheadRect.top < 0) {
    typeaheadContainerNode.scrollIntoView({
      block: 'center',
    });
  }

  target.scrollIntoView({ block: 'nearest' });
};

export const PUNCTUATION = '\\.,\\+\\*\\?\\$\\@\\|#{}\\(\\)\\^\\-\\[\\]\\\\/!%\'"~=<>_:;';

export function getBasicTypeaheadTriggerMatch(
  trigger: string,
  {
    minLength = 0,
    maxLength = 75,
    punctuation = PUNCTUATION,
    allowWhitespace = false,
  }: {
    allowWhitespace?: boolean;
    maxLength?: number;
    minLength?: number;
    punctuation?: string;
  },
) {
  return (text: string) => {
    const validCharsSuffix = allowWhitespace ? '' : '\\s';
    const validChars = '[^' + trigger + punctuation + validCharsSuffix + ']';
    const TypeaheadTriggerRegex = new RegExp(
      '(^|\\s|\\()(' + '[' + trigger + ']' + '((?:' + validChars + '){0,' + maxLength + '})' + ')$',
    );
    const match = TypeaheadTriggerRegex.exec(text);

    if (match !== null) {
      const maybeLeadingWhitespace = match[1];
      const matchingString = match[3];
      if (matchingString.length >= minLength) {
        return {
          leadOffset: match.index + maybeLeadingWhitespace.length,
          matchingString,
          replaceableString: match[2],
        };
      }
    }
    return null;
  };
}

/**
 * Walk backwards along user input and forward through entity title to try
 * and replace more of the user's text with entity.
 */
function getFullMatchOffset(documentText: string, entryText: string, offset: number): number {
  let triggerOffset = offset;
  for (let i = triggerOffset; i <= entryText.length; i++) {
    if (documentText.slice(-i) === entryText.slice(0, Math.max(0, i))) {
      triggerOffset = i;
    }
  }
  return triggerOffset;
}

/**
 * Split Lexical TextNode and return a new TextNode only containing matched text.
 * Common use cases include: removing the node, replacing with a new node.
 */
export function $splitNodeContainingQuery(match: {
  leadOffset: number;
  matchingString: string;
  replaceableString: string;
}): TextNode | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
    return null;
  }
  const anchor = selection.anchor;
  if (anchor.type !== 'text') {
    return null;
  }
  const anchorNode = anchor.getNode();
  if (!anchorNode.isSimpleText()) {
    return null;
  }
  const selectionOffset = anchor.offset;
  const textContent = anchorNode.getTextContent().slice(0, selectionOffset);
  const characterOffset = match.replaceableString.length;
  const queryOffset = getFullMatchOffset(textContent, match.matchingString, characterOffset);
  const startOffset = selectionOffset - queryOffset;
  if (startOffset < 0) {
    return null;
  }
  let newNode;
  if (startOffset === 0) {
    [newNode] = anchorNode.splitText(selectionOffset);
  } else {
    [, newNode] = anchorNode.splitText(startOffset, selectionOffset);
  }

  return newNode;
}
