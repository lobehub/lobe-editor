import {
  $getSelection,
  $isRangeSelection,
  LexicalEditor,
  RangeSelection,
  getDOMSelection,
} from 'lexical';

/**
 * Get the text content of the editor up to the anchor point of the selection.
 * 获取选区的锚点之前的文本内容
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
 * 获取编辑器中选区锚点之前的文本内容
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
