import { $isCodeNode } from '@lexical/code-core';
import { mergeRegister } from '@lexical/utils';
import type { LexicalEditor } from 'lexical';
import {
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
} from 'lexical';

import { ENTER_HOLE_CONTENT_COMMAND, getHoleContentEntrySide } from '@/plugins/common/command';
import { $isHoleNode } from '@/plugins/common/node/hole';
import { registerSharedCommand } from '@/plugins/common/node/navigation';
import { shouldHandleNavigationEvent } from '@/plugins/common/node/navigation-guards';

type CodeblockBoundaryDirection = 'before' | 'after';

/**
 * A CodeNode inside a Hole owns the last editable arrow at either edge. Move
 * the Lexical selection to the persistent Hole cursor and consume the native
 * arrow so DOM selection cannot outrun model selection until `selectionchange`.
 */
function exitCodeblockAtHoleBoundary(
  editor: LexicalEditor,
  event: KeyboardEvent,
  direction: CodeblockBoundaryDirection,
): boolean {
  if (!shouldHandleNavigationEvent(editor, event)) return false;

  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

  const point = selection.focus;
  const focusNode = point.getNode();
  const codeNode = $isCodeNode(focusNode)
    ? focusNode
    : $isCodeNode(focusNode.getParent())
      ? focusNode.getParent()
      : null;
  if (!$isCodeNode(codeNode)) return false;

  const hole = codeNode.getParent();
  if (!$isHoleNode(hole) || !hole.getContentChildren().some((child) => child.is(codeNode))) {
    return false;
  }

  const edgeNode =
    direction === 'before' ? codeNode.getFirstDescendant() : codeNode.getLastDescendant();
  const atBoundary =
    point.type === 'element' && focusNode.is(codeNode)
      ? point.offset === (direction === 'before' ? 0 : codeNode.getChildrenSize())
      : Boolean(
          edgeNode &&
          focusNode.is(edgeNode) &&
          point.offset === (direction === 'before' ? 0 : focusNode.getTextContentSize()),
        );
  if (!atBoundary) return false;

  event.preventDefault();
  const holeKey = hole.getKey();
  editor.update(
    () => {
      const currentHole = $getNodeByKey(holeKey);
      if (!$isHoleNode(currentHole)) return;
      currentHole.normalizeBoundaryCursors();
      const cursor =
        direction === 'before' ? currentHole.getBeforeCursor() : currentHole.getAfterCursor();
      if (!cursor) return;
      if (direction === 'before') cursor.selectEnd();
      else cursor.selectStart();
    },
    { discrete: true },
  );
  return true;
}

/**
 * Register the ordinary CodeNode as an editable Hole target. This module is
 * shared by browser and headless codeblock plugins and intentionally imports
 * no renderer, highlighter, or React code.
 */
export const registerCodeblockHoleEntry = (editor: LexicalEditor): (() => void) =>
  mergeRegister(
    editor.registerCommand(
      ENTER_HOLE_CONTENT_COMMAND,
      (payload) => {
        const side = getHoleContentEntrySide(payload);
        if (!side) return false;

        const target = $getNodeByKey(payload.key);
        if (!$isCodeNode(target)) return false;

        const descendant =
          side === 'before' ? target.getFirstDescendant() : target.getLastDescendant();
        if ($isTextNode(descendant)) {
          return Boolean(side === 'before' ? descendant.selectStart() : descendant.selectEnd());
        }

        return Boolean(side === 'before' ? target.selectStart() : target.selectEnd());
      },
      COMMAND_PRIORITY_HIGH,
    ),
    registerSharedCommand(
      editor,
      KEY_ARROW_LEFT_COMMAND,
      (event) => exitCodeblockAtHoleBoundary(editor, event, 'before'),
      COMMAND_PRIORITY_HIGH,
    ),
    registerSharedCommand(
      editor,
      KEY_ARROW_RIGHT_COMMAND,
      (event) => exitCodeblockAtHoleBoundary(editor, event, 'after'),
      COMMAND_PRIORITY_HIGH,
    ),
  );
