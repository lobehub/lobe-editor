import { $getTableCellNodeFromLexicalNode, $isTableSelection } from '@lexical/table';
import type { EditorState, LexicalEditor, NodeKey } from 'lexical';
import { $getSelection, $isRangeSelection } from 'lexical';
import { useEffect } from 'react';

const $getSelectedTableCellKey = (): NodeKey | null => {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) && !$isTableSelection(selection)) return null;

  return $getTableCellNodeFromLexicalNode(selection.anchor.getNode())?.getKey() ?? null;
};

/** UI-only behavior that keeps keyboard-focused table cells inside the visible scroll area. */
export const useScrollFocusedTableCellIntoView = (editor: LexicalEditor | null) => {
  useEffect(() => {
    if (!editor) return;

    let frame: number | null = null;
    let selectedCellKey: NodeKey | null = null;

    const cancelScheduledScroll = () => {
      if (frame === null) return;
      cancelAnimationFrame(frame);
      frame = null;
    };

    const handleEditorState = (editorState: EditorState) => {
      const nextCellKey = editorState.read($getSelectedTableCellKey);
      if (nextCellKey === selectedCellKey) return;

      selectedCellKey = nextCellKey;
      cancelScheduledScroll();
      if (!nextCellKey) return;

      frame = requestAnimationFrame(() => {
        frame = null;
        editor
          .getElementByKey(nextCellKey)
          ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    };

    handleEditorState(editor.getEditorState());
    const unregister = editor.registerUpdateListener(({ editorState }) => {
      handleEditorState(editorState);
    });

    return () => {
      cancelScheduledScroll();
      unregister();
    };
  }, [editor]);
};
