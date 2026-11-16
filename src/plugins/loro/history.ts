import {
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  HISTORY_MERGE_TAG,
  HISTORY_PUSH_TAG,
  type LexicalEditor,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical';

import type { LoroLexicalBinding } from './binding';
import { LORO_REMOTE_TAG } from './binding';

export interface LoroHistoryOptions {
  /** Match the editor's Lexical history merge window. */
  mergeInterval?: number;
}

/**
 * Routes Lexical's standard history commands to the Loro UndoManager.
 *
 * The handler is registered at CRITICAL priority and consumes an empty stack
 * as well. That keeps CommonPlugin's snapshot history from undoing hydration
 * or remote projection when Loro owns the document.
 */
export const registerLoroHistory = (
  editor: LexicalEditor,
  binding: LoroLexicalBinding,
  options: LoroHistoryOptions = {},
): (() => void) => {
  binding.setHistoryMergeInterval(options.mergeInterval ?? 300);
  let disposed = false;

  const updateUndoRedoState = (): void => {
    if (disposed) return;
    editor.dispatchCommand(CAN_UNDO_COMMAND, binding.canUndo());
    editor.dispatchCommand(CAN_REDO_COMMAND, binding.canRedo());
  };

  const unsubscribeCanonical = binding.canonical.subscribe(updateUndoRedoState);
  const unsubscribeEditable = editor.registerEditableListener(updateUndoRedoState);

  // The binding closes push-tagged commits and widens merge-tagged commits.
  // Complete the boundary after the Lexical transaction so the next update
  // uses the configured interval.
  const unregisterBoundary = editor.registerUpdateListener(
    ({ dirtyElements, dirtyLeaves, editorState, tags }) => {
      if ((dirtyElements.size > 0 || dirtyLeaves.size > 0) && !tags.has(LORO_REMOTE_TAG)) {
        binding.captureHistoryAfterCommit(editorState);
      }
      if (tags.has(HISTORY_PUSH_TAG) || tags.has(HISTORY_MERGE_TAG)) {
        binding.completeHistoryUpdate(tags);
        updateUndoRedoState();
      }
    },
  );

  const unregisterUndo = editor.registerCommand(
    UNDO_COMMAND,
    () => {
      binding.undo();
      updateUndoRedoState();
      return true;
    },
    COMMAND_PRIORITY_CRITICAL,
  );

  const unregisterRedo = editor.registerCommand(
    REDO_COMMAND,
    () => {
      binding.redo();
      updateUndoRedoState();
      return true;
    },
    COMMAND_PRIORITY_CRITICAL,
  );

  updateUndoRedoState();

  return () => {
    if (disposed) return;
    disposed = true;
    unsubscribeCanonical();
    unsubscribeEditable();
    unregisterBoundary();
    unregisterUndo();
    unregisterRedo();
  };
};
