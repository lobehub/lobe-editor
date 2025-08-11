import { $getSelection, $isNodeSelection, $isRangeSelection, LexicalEditor } from 'lexical';

import { $isMentionNode } from '../node/MentionNode';

export function registerMentionNodeSelectionObserver(editor: LexicalEditor): () => void {
  const selectMentionKeys: string[] = [];
  return editor.registerUpdateListener(({ editorState }) => {
    const selection = editorState.read(() => $getSelection());
    const newSelectMentionKeys: string[] = [];
    if ($isNodeSelection(selection)) {
      const nodes = editorState.read(() => selection.getNodes());
      nodes.forEach((node) => {
        if (node.getType() === 'mention') {
          newSelectMentionKeys.push(node.getKey());
        }
      });
    } else if ($isRangeSelection(selection) && !selection.isCollapsed()) {
      editorState.read(() => {
        selection.getNodes().forEach((node) => {
          if ($isMentionNode(node)) {
            newSelectMentionKeys.push(node.getKey());
          }
        });
      });
    }
    const removeKeys = selectMentionKeys.filter((key) => !newSelectMentionKeys.includes(key));
    const addKeys = newSelectMentionKeys.filter((key) => !selectMentionKeys.includes(key));
    selectMentionKeys.length = 0;
    selectMentionKeys.push(...newSelectMentionKeys);

    removeKeys.forEach((key) => {
      editor.getElementByKey(key)?.classList.remove('selected');
    });
    addKeys.forEach((key) => {
      editor.getElementByKey(key)?.classList.add('selected');
    });
  });
}
