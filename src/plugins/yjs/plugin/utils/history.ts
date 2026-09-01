import { type Binding, createUndoManager } from '@lexical/yjs';
import {
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  HISTORY_PUSH_TAG,
  type LexicalEditor,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical';

export function registerYjsHistory(editor: LexicalEditor, binding: Binding): () => void {
  const undoManager = createUndoManager(binding, binding.root.getSharedType());

  const updateUndoRedoState = () => {
    editor.dispatchCommand(CAN_UNDO_COMMAND, undoManager.undoStack.length > 0);
    editor.dispatchCommand(CAN_REDO_COMMAND, undoManager.redoStack.length > 0);
  };

  undoManager.on('stack-item-added', updateUndoRedoState);
  undoManager.on('stack-item-popped', updateUndoRedoState);
  undoManager.on('stack-cleared', updateUndoRedoState);

  // Lexical's HISTORY_PUSH_TAG defines a user-visible history boundary, while
  // Yjs otherwise coalesces transactions for its capture timeout. Registering
  // this listener before the Yjs editor-sync listener lets the boundary be
  // closed before the tagged transaction is written to the shared type.
  const stopCapturingAtLexicalBoundary = editor.registerUpdateListener(({ tags }) => {
    if (tags.has(HISTORY_PUSH_TAG)) undoManager.stopCapturing();
  });

  const unregisterUndo = editor.registerCommand(
    UNDO_COMMAND,
    () => {
      // Yjs owns history only while it has a local stack item. Returning
      // `false` for an empty stack lets the regular Lexical history handler
      // continue at its lower priority (and, importantly, prevents Ctrl/Cmd+Z
      // from being swallowed by an idle collaboration plugin).
      if (undoManager.undoStack.length === 0) return false;
      undoManager.undo();
      return true;
    },
    COMMAND_PRIORITY_CRITICAL,
  );

  const unregisterRedo = editor.registerCommand(
    REDO_COMMAND,
    () => {
      // Mirror the undo fallback for redo. A collaboration plugin must not
      // consume the command when there is nothing in its own stack.
      if (undoManager.redoStack.length === 0) return false;
      undoManager.redo();
      return true;
    },
    COMMAND_PRIORITY_CRITICAL,
  );

  return () => {
    unregisterUndo();
    unregisterRedo();
    stopCapturingAtLexicalBoundary();
    undoManager.off('stack-item-added', updateUndoRedoState);
    undoManager.off('stack-item-popped', updateUndoRedoState);
    undoManager.off('stack-cleared', updateUndoRedoState);
    undoManager.destroy();
  };
}
