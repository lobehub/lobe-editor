import type { HistoryState } from '@lexical/history';
import type { LexicalEditor } from 'lexical';

/**
 * Upper bound on node-map entries kept alive by the undo stack (about 60 MB).
 *
 * Every undo entry holds a full EditorState, whose node map has one entry per node. Inserting a
 * document line by line pushes about two entries per line, so without a bound the retained memory
 * grows with lines x document size: ~450 MB at 2,000 lines and enough to crash the tab beyond.
 */
export const HISTORY_MAX_RETAINED_NODES = 1_000_000;

/** Undo depth that is always kept, however large the document. */
export const HISTORY_MIN_UNDO_STEPS = 100;

/**
 * Drop the oldest undo entries once the stack would retain more than `maxRetainedNodes` node
 * entries at the current document size. Small documents keep (far) more steps than they use;
 * very large ones keep at least `minUndoSteps`. Register after `registerHistory` so this sees
 * the entry that update pushed.
 */
export function registerHistoryMemoryLimit(
  editor: LexicalEditor,
  historyState: HistoryState,
  {
    maxRetainedNodes = HISTORY_MAX_RETAINED_NODES,
    minUndoSteps = HISTORY_MIN_UNDO_STEPS,
  }: { maxRetainedNodes?: number; minUndoSteps?: number } = {},
): () => void {
  return editor.registerUpdateListener(({ editorState }) => {
    const { undoStack } = historyState;
    const nodeCount = Math.max(1, editorState._nodeMap.size);
    const maxSteps = Math.max(minUndoSteps, Math.floor(maxRetainedNodes / nodeCount));
    if (undoStack.length > maxSteps) undoStack.splice(0, undoStack.length - maxSteps);
  });
}
