import { $isTableSelection } from '@lexical/table';
import {
  $getSelection,
  HISTORIC_TAG,
  type LexicalEditor,
  SKIP_SCROLL_INTO_VIEW_TAG,
} from 'lexical';

import { $getValidTableSelectionShape, $repairInvalidTableSelection } from '../utils';

/** Repair only a stale table selection restored by an editable history update. */
export const registerTableSelectionHistoryRepair = (editor: LexicalEditor): (() => void) => {
  let scheduled = false;
  let disposed = false;

  const scheduleRepair = () => {
    if (scheduled || disposed) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (disposed || !editor.isEditable()) return;

      let needsRepair = false;
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        needsRepair = $isTableSelection(selection) && !$getValidTableSelectionShape(selection);
      });
      if (!needsRepair || !editor.isEditable()) return;

      editor.update(
        () => {
          if (editor.isEditable()) $repairInvalidTableSelection();
        },
        { tag: [HISTORIC_TAG, SKIP_SCROLL_INTO_VIEW_TAG] },
      );
    });
  };

  const unregister = editor.registerUpdateListener(({ tags }) => {
    if (tags.has(HISTORIC_TAG) && editor.isEditable()) scheduleRepair();
  });

  return () => {
    disposed = true;
    unregister();
  };
};
