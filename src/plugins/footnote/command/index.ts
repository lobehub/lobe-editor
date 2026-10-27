import { $findMatchingParent, mergeRegister } from '@lexical/utils';
import type { LexicalEditor, NodeKey } from 'lexical';
import {
  $addUpdateTag,
  $getNodeByKey,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  $onUpdate,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  SKIP_SCROLL_INTO_VIEW_TAG,
} from 'lexical';

import { $createFootnoteNode } from '../node/FootnoteNode';
import { $isFootnoteSectionNode } from '../node/FootnoteSectionNode';
import {
  $collectFootnotes,
  $ensureFootnoteDefinition,
  $findFootnoteDefinition,
  $getNextFootnoteIdentifier,
  normalizeFootnoteIdentifier,
} from '../utils';

export interface InsertFootnotePayload {
  focusDefinition?: boolean;
  identifier?: string;
}

export const INSERT_FOOTNOTE_COMMAND = createCommand<InsertFootnotePayload | undefined>(
  'INSERT_FOOTNOTE_COMMAND',
);

export const FOOTNOTE_JUMP_TO_DEFINITION_COMMAND = createCommand<string>(
  'FOOTNOTE_JUMP_TO_DEFINITION_COMMAND',
);

export const FOOTNOTE_JUMP_TO_REFERENCE_COMMAND = createCommand<string>(
  'FOOTNOTE_JUMP_TO_REFERENCE_COMMAND',
);

function scrollToKey(editor: LexicalEditor, key: NodeKey | null) {
  if (!key) return;
  const element = editor.getElementByKey(key);
  if (typeof element?.scrollIntoView === 'function') {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function $jumpToDefinition(editor: LexicalEditor, identifier: string) {
  if (!editor.isEditable()) {
    scrollToKey(editor, $findFootnoteDefinition(identifier)?.getKey() ?? null);
    return;
  }

  const definition = $ensureFootnoteDefinition(identifier);
  definition.selectEnd();
  $addUpdateTag(SKIP_SCROLL_INTO_VIEW_TAG);
  $onUpdate(() => scrollToKey(editor, definition.getKey()));
}

function $jumpToReference(editor: LexicalEditor, identifier: string) {
  const key = $collectFootnotes().references.get(identifier)?.[0] ?? null;
  if (!editor.isEditable()) {
    scrollToKey(editor, key);
    return;
  }

  const reference = key ? $getNodeByKey(key) : null;
  if (!reference) return;
  reference.selectNext(0, 0);
  $addUpdateTag(SKIP_SCROLL_INTO_VIEW_TAG);
  $onUpdate(() => scrollToKey(editor, key));
}

function $insertFootnote(editor: LexicalEditor, payload?: InsertFootnotePayload): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;
  if ($findMatchingParent(selection.anchor.getNode(), $isFootnoteSectionNode)) return false;

  const identifier =
    normalizeFootnoteIdentifier(payload?.identifier) || $getNextFootnoteIdentifier();
  const reference = $createFootnoteNode(identifier);
  $insertNodes([reference]);
  const definition = $ensureFootnoteDefinition(identifier);

  if (payload?.focusDefinition === false) {
    reference.selectNext(0, 0);
    return true;
  }

  definition.selectEnd();
  $addUpdateTag(SKIP_SCROLL_INTO_VIEW_TAG);
  $onUpdate(() => scrollToKey(editor, definition.getKey()));
  return true;
}

export function registerFootnoteCommands(editor: LexicalEditor) {
  return mergeRegister(
    editor.registerCommand(
      INSERT_FOOTNOTE_COMMAND,
      (payload) => $insertFootnote(editor, payload),
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      FOOTNOTE_JUMP_TO_DEFINITION_COMMAND,
      (identifier) => {
        $jumpToDefinition(editor, identifier);
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      FOOTNOTE_JUMP_TO_REFERENCE_COMMAND,
      (identifier) => {
        $jumpToReference(editor, identifier);
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
  );
}
