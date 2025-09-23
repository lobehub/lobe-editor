import {
  $caretFromPoint,
  $getCaretRange,
  $getChildCaret,
  $getRoot,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  $isTextPointCaret,
  $parseSerializedNode,
  BaseSelection,
  LexicalEditor,
  LexicalNode,
  SELECTION_INSERT_CLIPBOARD_NODES_COMMAND,
  TextNode,
} from 'lexical';

/**
 * Returns true if the node can contain transformable markdown.
 * Code nodes cannot contain transformable markdown.
 * For example, `code **bold**` should not be transformed to
 * <code>code <strong>bold</strong></code>.
 */
export function canContainTransformableMarkdown(node: LexicalNode | undefined): node is TextNode {
  return $isTextNode(node) && !node.hasFormat('code');
}

export function isEqualSubString(
  stringA: string,
  aStart: number,
  stringB: string,
  bStart: number,
  length: number,
): boolean {
  for (let i = 0; i < length; i++) {
    if (stringA[aStart + i] !== stringB[bStart + i]) {
      return false;
    }
  }

  return true;
}

// eslint-disable-next-line unicorn/better-regex
export const PUNCTUATION_OR_SPACE = /[!-/:-@[-`{-~\s]/;

export function getOpenTagStartIndex(string: string, maxIndex: number, tag: string): number {
  const tagLength = tag.length;

  for (let i = maxIndex; i >= tagLength; i--) {
    const startIndex = i - tagLength;

    if (
      isEqualSubString(string, startIndex, tag, 0, tagLength) && // Space after opening tag cancels transformation
      string[startIndex + tagLength] !== ' '
    ) {
      return startIndex;
    }
  }

  return -1;
}

export function indexBy<T>(
  list: Array<T>,
  callback: (arg0: T) => string | undefined,
): Readonly<Record<string, Array<T>>> {
  const index: Record<string, Array<T>> = {};

  for (const item of list) {
    const key = callback(item);

    if (!key) {
      continue;
    }

    if (index[key]) {
      index[key].push(item);
    } else {
      index[key] = [item];
    }
  }

  return index;
}

let Punctuation = /[!"#$%&'()*+,./:;<=>?@[\\\]^_`{|}~\u00A1\u2010-\u2027-]/;
try {
  Punctuation = new RegExp('[\\p{Pc}|\\p{Pd}|\\p{Pe}|\\p{Pf}|\\p{Pi}|\\p{Po}|\\p{Ps}]', 'u');
} catch {}

/**
 * Checks if a character is a punctuation character.
 * @param char The character to check.
 * @returns True if the character is a punctuation character, false otherwise.
 */
export function isPunctuationChar(char: string): boolean {
  return Punctuation.test(char);
}

function $updateSelectionOnInsert(selection: BaseSelection): void {
  if ($isRangeSelection(selection) && selection.isCollapsed()) {
    const anchor = selection.anchor;
    let nodeToInspect: LexicalNode | null = null;

    const anchorCaret = $caretFromPoint(anchor, 'previous');
    if (anchorCaret) {
      if ($isTextPointCaret(anchorCaret)) {
        nodeToInspect = anchorCaret.origin;
      } else {
        const range = $getCaretRange(anchorCaret, $getChildCaret($getRoot(), 'next').getFlipped());
        for (const caret of range) {
          if ($isTextNode(caret.origin)) {
            nodeToInspect = caret.origin;
            break;
          } else if ($isElementNode(caret.origin) && !caret.origin.isInline()) {
            break;
          }
        }
      }
    }

    if (nodeToInspect && $isTextNode(nodeToInspect)) {
      const newFormat = nodeToInspect.getFormat();
      const newStyle = nodeToInspect.getStyle();

      if (selection.format !== newFormat || selection.style !== newStyle) {
        selection.format = newFormat;
        selection.style = newStyle;
        selection.dirty = true;
      }
    }
  }
}

/**
 * Inserts Lexical nodes into the editor using different strategies depending on
 * some simple selection-based heuristics. If you're looking for a generic way to
 * to insert nodes into the editor at a specific selection point, you probably want
 * {@link lexical.$insertNodes}
 *
 * @param editor LexicalEditor instance to insert the nodes into.
 * @param nodes The nodes to insert.
 * @param selection The selection to insert the nodes into.
 */
export function $insertGeneratedNodes(
  editor: LexicalEditor,
  nodes: Array<LexicalNode>,
  selection: BaseSelection,
): void {
  if (
    !editor.dispatchCommand(SELECTION_INSERT_CLIPBOARD_NODES_COMMAND, {
      nodes,
      selection,
    })
  ) {
    selection.insertNodes(nodes);
    $updateSelectionOnInsert(selection);
  }
  return;
}

export interface BaseSerializedNode {
  children?: Array<BaseSerializedNode>;
  type: string;
  version: number;
}

/**
 * Creates an object containing all the styles and their values provided in the CSS string.
 * @param css - The CSS string of styles and their values.
 * @returns The styleObject containing all the styles and their values.
 */
export function getStyleObjectFromRawCSS(css: string): Record<string, string> {
  const styleObject: Record<string, string> = {};
  if (!css) {
    return styleObject;
  }
  const styles = css.split(';');

  for (const style of styles) {
    if (style !== '') {
      const [key, value] = style.split(/:([^]+)/); // split on first colon
      if (key && value) {
        styleObject[key.trim()] = value.trim();
      }
    }
  }

  return styleObject;
}

/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
export const CSS_TO_STYLES: Map<string, Record<string, string>> = new Map();

/**
 * Gets the TextNode's style object and adds the styles to the CSS.
 * @param node - The TextNode to add styles to.
 */
export function $addNodeStyle(node: TextNode): void {
  const CSSText = node.getStyle();
  const styles = getStyleObjectFromRawCSS(CSSText);
  CSS_TO_STYLES.set(CSSText, styles);
}

/**
 * This method takes an array of objects conforming to the BaseSerializedNode interface and returns
 * an Array containing instances of the corresponding LexicalNode classes registered on the editor.
 * Normally, you'd get an Array of BaseSerialized nodes from {@link $generateJSONFromSelectedNodes}
 *
 * @param serializedNodes an Array of objects conforming to the BaseSerializedNode interface.
 * @returns an Array of Lexical Node objects.
 */
export function $generateNodesFromSerializedNodes(
  serializedNodes: Array<BaseSerializedNode>,
): Array<LexicalNode> {
  const nodes = [];
  for (const serializedNode of serializedNodes) {
    const node = $parseSerializedNode(serializedNode);
    if ($isTextNode(node)) {
      $addNodeStyle(node);
    }
    nodes.push(node);
  }
  return nodes;
}
