import { HistoryState, HistoryStateEntry } from '@lexical/history';
import {
  $getSelection,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_HIGH,
  HISTORIC_TAG,
  LexicalEditor,
  createCommand,
} from 'lexical';

import { createDebugLogger } from '@/utils/debug';

import { parseMarkdownToLexical } from '../data-source/markdown/parse';
import { MarkdownShortCutService } from '../service/shortcut';
import { $generateNodesFromSerializedNodes, $insertGeneratedNodes } from '../utils';

const logger = createDebugLogger('plugin', 'markdown');

export const INSERT_MARKDOWN_COMMAND = createCommand<{
  historyState: HistoryStateEntry | null;
  markdown: string;
}>('INSERT_MARKDOWN_COMMAND');

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

export function registerMarkdownCommand(
  editor: LexicalEditor,
  service: MarkdownShortCutService,
  history: HistoryState,
) {
  return editor.registerCommand(
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
  );
}
