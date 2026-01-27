import { HistoryState, HistoryStateEntry } from '@lexical/history';
import { mergeRegister } from '@lexical/utils';
import {
  $getSelection,
  $isRangeSelection,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_HIGH,
  HISTORIC_TAG,
  LexicalEditor,
  createCommand,
} from 'lexical';

import { IEditorKernel } from '@/types';
import { createDebugLogger } from '@/utils/debug';

import { parseMarkdownToLexical } from '../data-source/markdown/parse';
import { MarkdownShortCutService } from '../service/shortcut';
import { $generateNodesFromSerializedNodes, $insertGeneratedNodes } from '../utils';

const logger = createDebugLogger('plugin', 'markdown');

export const INSERT_MARKDOWN_COMMAND = createCommand<{
  historyState: HistoryStateEntry | null;
  markdown: string;
}>('INSERT_MARKDOWN_COMMAND');

export const GET_MARKDOWN_SELECTION_COMMAND = createCommand<{
  onResult: (startLine: number, endLine: number) => void;
}>('GET_MARKDOWN_SELECTION_COMMAND');

function undoToEntry(
  editor: LexicalEditor,
  historyState: HistoryState,
  entry: HistoryStateEntry | null,
) {
  const undoStack = historyState.undoStack;

  const current = historyState.current;

  if (current) {
    undoStack.push(current);
    editor.dispatchCommand(CAN_UNDO_COMMAND, false);
  }

  historyState.current = entry || null;

  if (entry) {
    editor.setEditorState(entry.editorState, {
      tag: HISTORIC_TAG,
    });
  }

  return editor.getEditorState();
}

const SPICAL_TEXT = '\uFFF0';

const getLineNumber = (content: string, charIndex: number): number => {
  return content.slice(0, Math.max(0, charIndex)).split('\n').length;
};

export function registerMarkdownCommand(
  editor: LexicalEditor,
  kernel: IEditorKernel,
  service: MarkdownShortCutService,
  history: HistoryState,
) {
  return mergeRegister(
    editor.registerCommand(
      INSERT_MARKDOWN_COMMAND,
      (payload) => {
        const { markdown } = payload;
        logger.debug('INSERT_MARKDOWN_COMMAND payload:', payload);
        undoToEntry(editor, history, payload.historyState);
        queueMicrotask(() => {
          editor.update(() => {
            try {
              // Use the markdown data source to parse the content
              const root = parseMarkdownToLexical(markdown, service.markdownReaders);
              const selection = $getSelection();
              const nodes = $generateNodesFromSerializedNodes(root.children);
              logger.debug('INSERT_MARKDOWN_COMMAND nodes:', nodes);
              $insertGeneratedNodes(editor, nodes, selection!);
              return true;
            } catch (error) {
              logger.error('Failed to handle markdown paste:', error);
            }
          });
        });
        return false;
      },
      COMMAND_PRIORITY_HIGH, // Priority
    ),
    editor.registerCommand(
      GET_MARKDOWN_SELECTION_COMMAND,
      (payload) => {
        const newEditor = kernel.cloneNodeEditor();
        const s = kernel.getSelection();
        if (s) {
          newEditor.setSelection(s);
          newEditor.getLexicalEditor()?.update(
            () => {
              const sel = $getSelection();
              if (!sel) {
                return;
              }
              if ($isRangeSelection(sel)) {
                const { key: anchorKey, offset: anchorOffset, type: anchorType } = sel.anchor;
                const { key: focusKey, offset: focusOffset, type: focusType } = sel.focus;
                const newRang = sel.clone();
                newRang.anchor.set(anchorKey, anchorOffset, anchorType);
                newRang.focus.set(anchorKey, anchorOffset, anchorType);
                newRang.insertText(SPICAL_TEXT);
                newRang.focus.set(focusKey, focusOffset, focusType);
                newRang.anchor.set(focusKey, focusOffset, focusType);
                newRang.insertText(SPICAL_TEXT);
              }
            },
            {
              onUpdate: () => {
                const markdownContent = newEditor.getDocument('markdown') as unknown as string;
                const startIndex = markdownContent.indexOf(SPICAL_TEXT);
                const endIndex = markdownContent.lastIndexOf(SPICAL_TEXT);

                const startLine = getLineNumber(markdownContent, startIndex);
                const endLine = getLineNumber(markdownContent, endIndex);

                payload.onResult(startLine, endLine);
                logger.debug('GET_MARKDOWN_SELECTION_COMMAND markdownContent:', markdownContent);
                logger.debug(
                  'GET_MARKDOWN_SELECTION_COMMAND startLine:',
                  startLine,
                  'endLine:',
                  endLine,
                );
                return markdownContent;
              },
            },
          );
        }
        return false;
      },
      COMMAND_PRIORITY_HIGH,
    ),
  );
}
