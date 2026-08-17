import type { LexicalEditor, PasteCommandType } from 'lexical';
import { COMMAND_PRIORITY_HIGH, CONTROLLED_TEXT_INSERTION_COMMAND, PASTE_COMMAND } from 'lexical';

const LEXICAL_CLIPBOARD_TYPE = 'application/x-lexical-editor';

interface SerializedClipboardNode {
  children?: SerializedClipboardNode[];
  type?: string;
}

type ClipboardDataReader = Pick<DataTransfer, 'getData'>;

const countNodesByType = (node: SerializedClipboardNode, type: string): number => {
  const ownCount = node.type === type ? 1 : 0;
  const childrenCount = Array.isArray(node.children)
    ? node.children.reduce((count, child) => count + countNodesByType(child, type), 0)
    : 0;

  return ownCount + childrenCount;
};

const isSingleCellLexicalTable = (serializedClipboard: string): boolean | undefined => {
  if (!serializedClipboard) return undefined;

  try {
    const clipboard = JSON.parse(serializedClipboard) as { nodes?: SerializedClipboardNode[] };
    if (!Array.isArray(clipboard.nodes) || clipboard.nodes.length !== 1) return false;

    const [rootNode] = clipboard.nodes;
    if (rootNode?.type !== 'table') return false;

    return (
      countNodesByType(rootNode, 'table') === 1 && countNodesByType(rootNode, 'tablecell') === 1
    );
  } catch {
    return undefined;
  }
};

const isSingleCellHTMLTable = (html: string): boolean => {
  if (!html || typeof DOMParser === 'undefined') return false;

  const document = new DOMParser().parseFromString(html, 'text/html');
  const tables = document.body.querySelectorAll('table');
  if (tables.length !== 1 || tables[0].querySelectorAll('td, th').length !== 1) return false;

  const remainder = document.body.cloneNode(true) as HTMLElement;
  remainder.querySelector('table')?.remove();
  remainder.querySelectorAll('link, meta, script, style').forEach((node) => node.remove());

  const hasVisibleNonTextContent = remainder.querySelector(
    'audio, canvas, iframe, img, object, svg, video',
  );

  return !hasVisibleNonTextContent && remainder.textContent?.trim() === '';
};

export const isSingleCellTableClipboard = (clipboardData: ClipboardDataReader): boolean => {
  const lexicalResult = isSingleCellLexicalTable(clipboardData.getData(LEXICAL_CLIPBOARD_TYPE));

  if (lexicalResult !== undefined) return lexicalResult;

  return isSingleCellHTMLTable(clipboardData.getData('text/html'));
};

export const getSingleCellPlainText = (clipboardData: ClipboardDataReader): string => {
  return clipboardData.getData('text/plain').replace(/(?:\r\n|\n)$/, '');
};

export const handleSingleCellTablePaste = (
  editor: Pick<LexicalEditor, 'dispatchCommand'>,
  event: PasteCommandType,
): boolean => {
  if (!('clipboardData' in event)) return false;

  const clipboardData = event.clipboardData;
  if (!clipboardData || !isSingleCellTableClipboard(clipboardData)) return false;

  event.preventDefault();
  editor.dispatchCommand(CONTROLLED_TEXT_INSERTION_COMMAND, getSingleCellPlainText(clipboardData));
  return true;
};

export const registerSingleCellTablePaste = (editor: LexicalEditor): (() => void) => {
  return editor.registerCommand(
    PASTE_COMMAND,
    (event) => handleSingleCellTablePaste(editor, event),
    COMMAND_PRIORITY_HIGH,
  );
};
