/* eslint-disable no-redeclare */
/* eslint-disable @typescript-eslint/no-redeclare */
import {
  $createRangeSelection,
  $getSelection,
  $isLineBreakNode,
  $isRangeSelection,
  $isRootOrShadowRoot,
  $isTextNode,
  $setSelection,
  ElementNode,
  LexicalNode,
  TextFormatType,
  TextNode,
} from 'lexical';

import { genServiceId } from '@/editor-kernel';
import { IServiceID } from '@/editor-kernel/types';

import { PUNCTUATION_OR_SPACE, getOpenTagStartIndex, indexBy, isEqualSubString } from '../utils';

export type TextFormatTransformer = Readonly<{
  format: ReadonlyArray<TextFormatType>;
  intraword?: boolean;
  tag: string;
  type: 'text-format';
}>;

export type TextMatchTransformer = Readonly<{
  /**
   * For import operations, this function can be used to determine the end index of the match, after `importRegExp` has matched.
   * Without this function, the end index will be determined by the length of the match from `importRegExp`. Manually determining the end index can be useful if
   * the match from `importRegExp` is not the entire text content of the node. That way, `importRegExp` can be used to match only the start of the node, and `getEndIndex`
   * can be used to match the end of the node.
   *
   * @returns The end index of the match, or false if the match was unsuccessful and a different transformer should be tried.
   */
  getEndIndex?: (node: TextNode, match: RegExpMatchArray) => number | false;
  /**
   * This regex determines what text is matched during markdown imports
   */
  importRegExp?: RegExp;
  /**
   * This regex determines what text is matched for markdown shortcuts while typing in the editor
   */
  regExp: RegExp;
  /**
   * Determines how the matched markdown text should be transformed into a node during the markdown import process
   *
   * @returns nothing, or a TextNode that may be a child of the new node that is created.
   * If a TextNode is returned, text format matching will be applied to it (e.g. bold, italic, etc.)
   */
  replace?: (node: TextNode, match: RegExpMatchArray) => void | TextNode;
  /**
   * Single character that allows the transformer to trigger when typed in the editor. This does not affect markdown imports outside of the markdown shortcut plugin.
   * If the trigger is matched, the `regExp` will be used to match the text in the second step.
   */
  trigger?: string;
  type: 'text-match';
}>;

export type ElementTransformer = {
  regExp: RegExp;
  /**
   * `replace` is called when markdown is imported or typed in the editor
   *
   * @return return false to cancel the transform, even though the regex matched. Lexical will then search for the next transformer.
   */
  replace: (
    parentNode: ElementNode,
    children: Array<LexicalNode>,
    match: Array<string>,
    /**
     * Whether the match is from an import operation (e.g. through `$convertFromMarkdownString`) or not (e.g. through typing in the editor).
     */
    isImport: boolean,
  ) => boolean | void;
  trigger?: 'enter';
  type: 'element';
};

export type Transformer = ElementTransformer | TextFormatTransformer | TextMatchTransformer;

export interface IMarkdownWriterContext {
  /**
   * Add processor
   * @param processor
   */
  addProcessor(processor: (before: string, content: string, after: string) => string): void;

  // Define the context properties needed for the markdown writer
  /**
   * Direct output
   * @param line
   * @returns
   */
  appendLine: (line: string) => void;

  /**
   * Wrap child elements
   * @param before
   * @param after
   * @returns
   */
  wrap: (before: string, after: string) => void;
}

export interface IMarkdownShortCutService {
  registerMarkdownShortCut(transformer: Transformer): void;
  registerMarkdownShortCuts(transformers: Transformer[]): void;
  /**
   * Register Markdown writer
   * @param type Lexical Node type
   * @param writer
   */
  registerMarkdownWriter(
    type: string,
    writer: (ctx: IMarkdownWriterContext, node: LexicalNode) => void,
  ): void;
}

export const IMarkdownShortCutService: IServiceID<IMarkdownShortCutService> =
  genServiceId<IMarkdownShortCutService>('MarkdownShortCutService');

function testElementTransformers(
  parentNode: ElementNode,
  anchorNode: TextNode,
  anchorOffset: number,
  elementTransformers: ReadonlyArray<ElementTransformer>,
  fromTrigger?: 'enter',
): boolean {
  const grandParentNode = parentNode.getParent();

  if (!$isRootOrShadowRoot(grandParentNode) || parentNode.getFirstChild() !== anchorNode) {
    return false;
  }

  const textContent = anchorNode.getTextContent();

  // Checking for anchorOffset position to prevent any checks for cases when caret is too far
  // from a line start to be a part of block-level markdown trigger.
  //
  // TODO:
  // Can have a quick check if caret is close enough to the beginning of the string (e.g. offset less than 10-20)
  // since otherwise it won't be a markdown shortcut, but tables are exception
  if (fromTrigger !== 'enter' && textContent[anchorOffset - 1] !== ' ') {
    return false;
  }

  for (const { regExp, trigger } of elementTransformers) {
    const match = textContent.match(regExp);

    if (
      fromTrigger === trigger &&
      match &&
      match[0].length ===
        (fromTrigger === 'enter' || match[0].endsWith(' ') ? anchorOffset : anchorOffset - 1)
    ) {
      return true;
    }
  }

  return false;
}

function runElementTransformers(
  parentNode: ElementNode,
  anchorNode: TextNode,
  anchorOffset: number,
  elementTransformers: ReadonlyArray<ElementTransformer>,
  fromTrigger?: 'enter',
): boolean {
  const grandParentNode = parentNode.getParent();

  if (!$isRootOrShadowRoot(grandParentNode) || parentNode.getFirstChild() !== anchorNode) {
    return false;
  }

  const textContent = anchorNode.getTextContent();

  // Checking for anchorOffset position to prevent any checks for cases when caret is too far
  // from a line start to be a part of block-level markdown trigger.
  //
  // TODO:
  // Can have a quick check if caret is close enough to the beginning of the string (e.g. offset less than 10-20)
  // since otherwise it won't be a markdown shortcut, but tables are exception
  if (fromTrigger !== 'enter' && textContent[anchorOffset - 1] !== ' ') {
    return false;
  }

  for (const { regExp, replace, trigger } of elementTransformers) {
    const match = textContent.match(regExp);

    if (
      fromTrigger === trigger &&
      match &&
      match[0].length ===
        (fromTrigger === 'enter' || match[0].endsWith(' ') ? anchorOffset : anchorOffset - 1)
    ) {
      const nextSiblings = anchorNode.getNextSiblings();
      const [leadingNode, remainderNode] = anchorNode.splitText(anchorOffset);
      const siblings = remainderNode ? [remainderNode, ...nextSiblings] : nextSiblings;
      if (replace(parentNode, siblings, match, false) !== false) {
        leadingNode.remove();
        return true;
      }
    }
  }

  return false;
}

function runTextMatchTransformers(
  anchorNode: TextNode,
  anchorOffset: number,
  transformersByTrigger: Readonly<Record<string, Array<TextMatchTransformer>>>,
): boolean {
  let textContent = anchorNode.getTextContent();
  const lastChar = textContent[anchorOffset - 1];
  const transformers = transformersByTrigger[lastChar];

  if (!transformers) {
    return false;
  }

  // If typing in the middle of content, remove the tail to do
  // reg exp match up to a string end (caret position)
  if (anchorOffset < textContent.length) {
    textContent = textContent.slice(0, anchorOffset);
  }

  for (const transformer of transformers) {
    if (!transformer.replace || !transformer.regExp) {
      continue;
    }
    const match = textContent.match(transformer.regExp);

    if (match === null) {
      continue;
    }

    const startIndex = match.index || 0;
    const endIndex = startIndex + match[0].length;
    let replaceNode;

    if (startIndex === 0) {
      [replaceNode] = anchorNode.splitText(endIndex);
    } else {
      [, replaceNode] = anchorNode.splitText(startIndex, endIndex);
    }

    replaceNode.selectNext(0, 0);
    transformer.replace(replaceNode, match);
    return true;
  }

  return false;
}

function $runTextFormatTransformers(
  anchorNode: TextNode,
  anchorOffset: number,
  textFormatTransformers: Readonly<Record<string, ReadonlyArray<TextFormatTransformer>>>,
): boolean {
  const textContent = anchorNode.getTextContent();
  const closeTagEndIndex = anchorOffset - 1;
  const closeChar = textContent[closeTagEndIndex];
  // Quick check if we're possibly at the end of inline markdown style
  const matchers = textFormatTransformers[closeChar];

  if (!matchers) {
    return false;
  }

  for (const matcher of matchers) {
    const { tag } = matcher;
    const tagLength = tag.length;
    const closeTagStartIndex = closeTagEndIndex - tagLength + 1;

    // If tag is not single char check if rest of it matches with text content
    if (tagLength > 1 && !isEqualSubString(textContent, closeTagStartIndex, tag, 0, tagLength)) {
      continue;
    }

    // Space before closing tag cancels inline markdown
    if (textContent[closeTagStartIndex - 1] === ' ') {
      continue;
    }

    // Some tags can not be used within words, hence should have newline/space/punctuation after it
    const afterCloseTagChar = textContent[closeTagEndIndex + 1];

    if (
      matcher.intraword === false &&
      afterCloseTagChar &&
      !PUNCTUATION_OR_SPACE.test(afterCloseTagChar)
    ) {
      continue;
    }

    const closeNode = anchorNode;
    let openNode = closeNode;
    let openTagStartIndex = getOpenTagStartIndex(textContent, closeTagStartIndex, tag);

    // Go through text node siblings and search for opening tag
    // if haven't found it within the same text node as closing tag
    let sibling: TextNode | null = openNode;

    while (openTagStartIndex < 0 && (sibling = sibling.getPreviousSibling<TextNode>())) {
      if ($isLineBreakNode(sibling)) {
        break;
      }

      if ($isTextNode(sibling)) {
        if (sibling.hasFormat('code')) {
          continue;
        }
        const siblingTextContent = sibling.getTextContent();
        openNode = sibling;
        openTagStartIndex = getOpenTagStartIndex(
          siblingTextContent,
          siblingTextContent.length,
          tag,
        );
      }
    }

    // Opening tag is not found
    if (openTagStartIndex < 0) {
      continue;
    }

    // No content between opening and closing tag
    if (openNode === closeNode && openTagStartIndex + tagLength === closeTagStartIndex) {
      continue;
    }

    // Checking longer tags for repeating chars (e.g. *** vs **)
    const prevOpenNodeText = openNode.getTextContent();

    if (openTagStartIndex > 0 && prevOpenNodeText[openTagStartIndex - 1] === closeChar) {
      continue;
    }

    // Some tags can not be used within words, hence should have newline/space/punctuation before it
    const beforeOpenTagChar = prevOpenNodeText[openTagStartIndex - 1];

    if (
      matcher.intraword === false &&
      beforeOpenTagChar &&
      !PUNCTUATION_OR_SPACE.test(beforeOpenTagChar)
    ) {
      continue;
    }

    // Clean text from opening and closing tags (starting from closing tag
    // to prevent any offset shifts if we start from opening one)
    const prevCloseNodeText = closeNode.getTextContent();
    const closeNodeText =
      prevCloseNodeText.slice(0, closeTagStartIndex) +
      prevCloseNodeText.slice(closeTagEndIndex + 1);
    closeNode.setTextContent(closeNodeText);
    const openNodeText = openNode === closeNode ? closeNodeText : prevOpenNodeText;
    openNode.setTextContent(
      openNodeText.slice(0, openTagStartIndex) + openNodeText.slice(openTagStartIndex + tagLength),
    );
    const selection = $getSelection();
    const nextSelection = $createRangeSelection();
    $setSelection(nextSelection);
    // Adjust offset based on deleted chars
    const newOffset = closeTagEndIndex - tagLength * (openNode === closeNode ? 2 : 1) + 1;
    nextSelection.anchor.set(openNode.__key, openTagStartIndex, 'text');
    nextSelection.focus.set(closeNode.__key, newOffset, 'text');

    // Apply formatting to selected text
    for (const format of matcher.format) {
      if (!nextSelection.hasFormat(format)) {
        nextSelection.formatText(format);
      }
    }

    // Collapse selection up to the focus point
    nextSelection.anchor.set(
      nextSelection.focus.key,
      nextSelection.focus.offset,
      nextSelection.focus.type,
    );

    // Remove formatting from collapsed selection
    for (const format of matcher.format) {
      if (nextSelection.hasFormat(format)) {
        nextSelection.toggleFormat(format);
      }
    }

    if ($isRangeSelection(selection)) {
      nextSelection.format = selection.format;
    }

    return true;
  }

  return false;
}

export class MarkdownShortCutService implements IMarkdownShortCutService {
  private elementTransformers: Array<ElementTransformer> = [];
  private textFormatTransformers: Array<TextFormatTransformer> = [];
  private textMatchTransformers: Array<TextMatchTransformer> = [];

  private _markdownWriters: Record<
    string,
    (ctx: IMarkdownWriterContext, node: LexicalNode) => void
  > = {};

  get markdownWriters() {
    return this._markdownWriters;
  }

  private _textFormatTransformersByTrigger: Readonly<
    Record<string, ReadonlyArray<TextFormatTransformer>>
  > | null = null;
  private _textMatchTransformersByTrigger: Readonly<
    Record<string, Array<TextMatchTransformer>>
  > | null = null;

  get textMatchTransformersByTrigger() {
    if (!this._textMatchTransformersByTrigger) {
      this._textMatchTransformersByTrigger = indexBy(
        this.textMatchTransformers,
        ({ trigger }) => trigger,
      );
    }
    return this._textMatchTransformersByTrigger;
  }

  get textFormatTransformersByTrigger() {
    if (!this._textFormatTransformersByTrigger) {
      this._textFormatTransformersByTrigger = indexBy(this.textFormatTransformers, ({ tag }) =>
        tag.at(-1),
      );
    }
    return this._textFormatTransformersByTrigger;
  }

  registerMarkdownShortCut(transformer: Transformer): void {
    switch (transformer.type) {
      case 'element': {
        this.elementTransformers.push(transformer);

        break;
      }
      case 'text-format': {
        this.textFormatTransformers.push(transformer);

        break;
      }
      case 'text-match': {
        this.textMatchTransformers.push(transformer);

        break;
      }
      default: {
        throw new Error(`Unknown transformer type: ${transformer}`);
      }
    }
  }

  registerMarkdownShortCuts(transformers: Transformer[]): void {
    for (const transformer of transformers) {
      this.registerMarkdownShortCut(transformer);
    }
  }

  testTransformers(
    parentNode: ElementNode,
    anchorNode: TextNode,
    anchorOffset: number,
    trigger?: 'enter',
  ): boolean {
    if (
      testElementTransformers(
        parentNode,
        anchorNode,
        anchorOffset,
        this.elementTransformers,
        trigger,
      )
    ) {
      return true;
    }

    return false;
  }

  runTransformers(
    parentNode: ElementNode,
    anchorNode: TextNode,
    anchorOffset: number,
    trigger?: 'enter',
  ): boolean {
    if (
      runElementTransformers(
        parentNode,
        anchorNode,
        anchorOffset,
        this.elementTransformers,
        trigger,
      )
    ) {
      return true;
    }

    if (runTextMatchTransformers(anchorNode, anchorOffset, this.textMatchTransformersByTrigger)) {
      return true;
    }

    if (
      $runTextFormatTransformers(anchorNode, anchorOffset, this.textFormatTransformersByTrigger)
    ) {
      return true;
    }

    return false;
  }

  registerMarkdownWriter(
    type: string,
    writer: (ctx: IMarkdownWriterContext, node: LexicalNode) => void,
  ): void {
    if (!this._markdownWriters[type]) {
      this._markdownWriters[type] = writer;
      return;
    }
    throw new Error(`Markdown writer for type "${type}" is already registered.`);
  }
}
