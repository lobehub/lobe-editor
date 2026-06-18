import { type Binding, createUndoManager } from '@lexical/yjs';
import {
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
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

  const unregisterUndo = editor.registerCommand(
    UNDO_COMMAND,
    () => {
      undoManager.undo();
      return true;
    },
    COMMAND_PRIORITY_CRITICAL,
  );

  const unregisterRedo = editor.registerCommand(
    REDO_COMMAND,
    () => {
      undoManager.redo();
      return true;
    },
    COMMAND_PRIORITY_CRITICAL,
  );

  return () => {
    unregisterUndo();
    unregisterRedo();
    undoManager.off('stack-item-added', updateUndoRedoState);
    undoManager.off('stack-item-popped', updateUndoRedoState);
    undoManager.off('stack-cleared', updateUndoRedoState);
    undoManager.destroy();
  };
}
