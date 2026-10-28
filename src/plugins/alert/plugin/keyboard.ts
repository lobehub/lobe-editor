import { mergeRegister } from '@lexical/utils';
import type { LexicalEditor, LexicalNode, RangeSelection } from 'lexical';
import {
  $createParagraphNode,
  $getSelection,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  INSERT_PARAGRAPH_COMMAND,
  KEY_BACKSPACE_COMMAND,
} from 'lexical';

import { $isAlertNode, AlertNode } from '../node/AlertNode';

function $getAlertChild(
  selection: RangeSelection,
): { alert: AlertNode; block: LexicalNode } | null {
  let node: LexicalNode | null = selection.anchor.getNode();
  while (node) {
    const parent: LexicalNode | null = node.getParent();
    if ($isAlertNode(parent)) return { alert: parent, block: node };
    node = parent;
  }
  return null;
}

function $isCaretAtBlockStart(selection: RangeSelection, block: LexicalNode): boolean {
  if (selection.anchor.offset !== 0) return false;
  let node: LexicalNode | null = selection.anchor.getNode();
  while (node && !node.is(block)) {
    if (node.getPreviousSibling()) return false;
    node = node.getParent();
  }
  return node !== null;
}

function $exitOnEmptyLastParagraph(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

  const match = $getAlertChild(selection);
  if (!match) return false;
  const { alert, block } = match;
  if (!$isParagraphNode(block) || block.getTextContentSize() > 0) return false;
  if (!block.is(alert.getLastChild()) || alert.getChildrenSize() < 2) return false;

  block.remove();
  const paragraph = $createParagraphNode();
  alert.insertAfter(paragraph);
  paragraph.select();
  return true;
}

function $unwrapAtStart(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

  const match = $getAlertChild(selection);
  if (!match) return false;
  const { alert, block } = match;
  if (!block.is(alert.getFirstChild()) || !$isCaretAtBlockStart(selection, block)) return false;

  const children = alert.getChildren();
  for (const child of children) {
    alert.insertBefore(child);
  }
  alert.remove();
  if ($isElementNode(block)) block.selectStart();
  return true;
}

export function registerAlertKeyboard(editor: LexicalEditor) {
  return mergeRegister(
    editor.registerNodeTransform(AlertNode, (alert) => {
      if (alert.isEmpty()) alert.append($createParagraphNode());
    }),
    editor.registerCommand(
      INSERT_PARAGRAPH_COMMAND,
      $exitOnEmptyLastParagraph,
      COMMAND_PRIORITY_LOW,
    ),
    editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      (event) => {
        const handled = $unwrapAtStart();
        if (handled) event?.preventDefault();
        return handled;
      },
      COMMAND_PRIORITY_LOW,
    ),
  );
}
