import type { LexicalNode } from 'lexical';
import { $getSelection, $isElementNode, $isRangeSelection, $isTextNode } from 'lexical';

import { PlaceholderBlockNode, PlaceholderNode } from '../node/placeholderNode';

export interface CompletionContext {
  afterText: string;
  fingerprint: string;
  input: string;
  selectionType: string;
}

/** Read the paragraph around the caret, excluding unaccepted preview content. */
export function $readCompletionContext(): CompletionContext | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null;
  const { anchor } = selection;
  const target = anchor.getNode();
  let block = target;
  while ($isTextNode(block) || block.isInline()) {
    const parent = block.getParent();
    if (!parent) break;
    block = parent;
  }
  let input = '';
  let afterText = '';
  let after = false;
  const append = (text: string) => {
    if (after) afterText += text;
    else input += text;
  };
  const visit = (node: LexicalNode) => {
    if (node instanceof PlaceholderNode || node instanceof PlaceholderBlockNode) return;
    if (node.is(target)) {
      if ($isElementNode(node)) {
        node.getChildren().forEach((child, index) => {
          after = index >= anchor.offset;
          visit(child);
        });
      } else {
        input += node.getTextContent().slice(0, anchor.offset);
        afterText += node.getTextContent().slice(anchor.offset);
      }
      after = true;
    } else if ($isElementNode(node)) {
      node.getChildren().forEach(visit);
    } else append(node.getTextContent());
  };
  visit(block);
  return {
    afterText,
    fingerprint: JSON.stringify([
      anchor.key,
      anchor.offset,
      anchor.type,
      input,
      afterText,
      selection.format,
      selection.style,
    ]),
    input,
    selectionType: target.getType(),
  };
}
