import { $getSelection, $isNodeSelection, $isRangeSelection, LexicalEditor } from 'lexical';

export function registerFileNodeSelectionObserver(editor: LexicalEditor): () => void {
  const selectFileKeys: string[] = [];
  return editor.registerUpdateListener(({ editorState }) => {
    const selection = editorState.read(() => $getSelection());
    const newSelectFileKeys: string[] = [];
    if ($isNodeSelection(selection)) {
      const nodes = editorState.read(() => selection.getNodes());
      nodes.forEach((node) => {
        if (node.getType() === 'file') {
          newSelectFileKeys.push(node.getKey());
        }
      });
    } else if ($isRangeSelection(selection) && !selection.isCollapsed()) {
      editorState.read(() => {
        selection.getNodes().forEach((node) => {
          if (node.getType() === 'file') {
            newSelectFileKeys.push(node.getKey());
          }
        });
      });
    }
    const removeKeys = selectFileKeys.filter((key) => !newSelectFileKeys.includes(key));
    const addKeys = newSelectFileKeys.filter((key) => !selectFileKeys.includes(key));
    selectFileKeys.length = 0;
    selectFileKeys.push(...newSelectFileKeys);

    removeKeys.forEach((key) => {
      editor.getElementByKey(key)?.classList.remove('selected');
    });
    addKeys.forEach((key) => {
      editor.getElementByKey(key)?.classList.add('selected');
    });
  });
}
