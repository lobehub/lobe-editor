import { $getSelection, $isRangeSelection, LexicalEditor, RangeSelection } from "lexical";

/**
 * Get the text content of the editor up to the anchor point of the selection.
 * 获取选区的锚点之前的文本内容
 * @param selection Selection object from Lexical editor
 * @returns 
 */
export function getTextUpToAnchor(selection: RangeSelection): string | null {
  const anchor = selection.anchor;
  if (anchor.type !== 'text') {
    return null;
  }
  const anchorNode = anchor.getNode();
  if (!anchorNode.isSimpleText()) {
    return null;
  }
  const anchorOffset = anchor.offset;
  return anchorNode.getTextContent().slice(0, anchorOffset);
}

/**
 * 
 * @param editor Lexical editor instance
 * 获取编辑器中选区锚点之前的文本内容
 * @returns 
 */
export function getQueryTextForSearch(editor: LexicalEditor): string | null {
  let text = null;
  editor.getEditorState().read(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
      return;
    }
    text = getTextUpToAnchor(selection);
  });
  return text;
}
