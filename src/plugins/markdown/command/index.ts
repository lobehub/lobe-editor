import { $getSelection, COMMAND_PRIORITY_HIGH, LexicalEditor, createCommand } from 'lexical';

import { createDebugLogger } from '@/utils/debug';

import { parseMarkdownToLexical } from '../data-source/markdown/parse';
import { MarkdownShortCutService } from '../service/shortcut';
import { $generateNodesFromSerializedNodes, $insertGeneratedNodes } from '../utils';

const logger = createDebugLogger('plugin', 'markdown');

export const INSERT_MARKDOWN_COMMAND = createCommand<{ markdown: string }>(
  'INSERT_MARKDOWN_COMMAND',
);

export function registerMarkdownCommand(editor: LexicalEditor, service: MarkdownShortCutService) {
  return editor.registerCommand(
    INSERT_MARKDOWN_COMMAND,
    (payload) => {
      const { markdown } = payload;
      logger.debug('INSERT_MARKDOWN_COMMAND payload:', payload);
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
      return false;
    },
    COMMAND_PRIORITY_HIGH, // Priority
  );
}
