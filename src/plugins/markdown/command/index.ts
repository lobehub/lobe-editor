import type { HistoryStateEntry } from '@lexical/history';
import { mergeRegister } from '@lexical/utils';
import type { LexicalEditor, LexicalNode } from 'lexical';
import {
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isRootNode,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  createCommand,
  HISTORIC_TAG,
  HISTORY_PUSH_TAG,
} from 'lexical';

import { $findNodeById, $getNodeId } from '@/plugins/common/node/node-id';
import type { IEditorKernel, ISelectionObject } from '@/types';
import { createDebugLogger } from '@/utils/debug';

import { parseMarkdownToLexical } from '../data-source/markdown/parse';
import type { MarkdownShortCutService } from '../service/shortcut';
import { $generateNodesFromSerializedNodes, $insertGeneratedNodes } from '../utils';

const logger = createDebugLogger('plugin', 'markdown');

export const INSERT_MARKDOWN_COMMAND = createCommand<{
  historyState: HistoryStateEntry | null;
  markdown: string;
}>('INSERT_MARKDOWN_COMMAND');

export const GET_MARKDOWN_SELECTION_COMMAND = createCommand<{
  onResult: (startLine: number, endLine: number) => void;
}>('GET_MARKDOWN_SELECTION_COMMAND');

function restoreToEntry(editor: LexicalEditor, entry: HistoryStateEntry | null) {
  if (!entry) return;

  editor.setEditorState(entry.editorState, {
    tag: HISTORIC_TAG,
  });
}

const SPICAL_TEXT = '\uFFF0';

const getLineNumber = (content: string, charIndex: number): number => {
  return content.slice(0, Math.max(0, charIndex)).split('\n').length;
};

type SelectionNodeReference = { id: string; kind: 'node' } | { kind: 'root' };

function getNodeReferenceForKey(editor: LexicalEditor, key: string): SelectionNodeReference | null {
  return editor.getEditorState().read(() => {
    const node = $getNodeByKey(key);
    if (!node) return null;
    if ($isRootNode(node)) return { kind: 'root' };

    const id = $getNodeId(node);
    return id ? { id, kind: 'node' } : null;
  });
}

function getNodeKeyForReference(
  editor: LexicalEditor,
  reference: SelectionNodeReference,
  offset: number,
): { key: string; offset: number } | undefined {
  return editor.getEditorState().read(
    () => {
      if (reference.kind === 'node') {
        const node = $findNodeById(reference.id);
        return node ? { key: node.getKey(), offset } : undefined;
      }

      const root = $getRoot();
      const findBoundaryText = (node: LexicalNode, first: boolean): LexicalNode | null => {
        if ($isTextNode(node)) return node;
        if (!$isElementNode(node)) return null;

        const children = node.getChildren();
        const orderedChildren = first ? children : [...children].reverse();
        for (const child of orderedChildren) {
          const textNode = findBoundaryText(child, first);
          if (textNode) return textNode;
        }
        return null;
      };

      if (offset === 0) {
        const firstText = findBoundaryText(root, true);
        if (firstText) return { key: firstText.getKey(), offset: 0 };
      }
      if (offset === root.getChildrenSize()) {
        const lastText = findBoundaryText(root, false);
        if (lastText) return { key: lastText.getKey(), offset: lastText.getTextContentSize() };
      }

      return { key: root.getKey(), offset };
    },
    { editor },
  );
}

function mapSelectionToEditor(
  selection: ISelectionObject,
  sourceEditor: LexicalEditor,
  targetEditor: LexicalEditor,
): ISelectionObject | null {
  const startReference = getNodeReferenceForKey(sourceEditor, selection.startNodeId);
  const endReference = getNodeReferenceForKey(sourceEditor, selection.endNodeId);
  if (!startReference || !endReference) return null;

  const startPoint = getNodeKeyForReference(targetEditor, startReference, selection.startOffset);
  const endPoint = getNodeKeyForReference(targetEditor, endReference, selection.endOffset);
  if (!startPoint || !endPoint) return null;

  return {
    ...selection,
    endNodeId: endPoint.key,
    endOffset: endPoint.offset,
    startNodeId: startPoint.key,
    startOffset: startPoint.offset,
  };
}

export function registerMarkdownCommand(
  editor: LexicalEditor,
  kernel: IEditorKernel,
  service: MarkdownShortCutService,
) {
  return mergeRegister(
    editor.registerCommand(
      INSERT_MARKDOWN_COMMAND,
      (payload) => {
        const { markdown } = payload;
        logger.debug('INSERT_MARKDOWN_COMMAND payload:', payload);
        restoreToEntry(editor, payload.historyState);
        setTimeout(() => {
          editor.update(
            () => {
              try {
                // Force a new history entry so undo returns to the raw pasted text.
                const root = parseMarkdownToLexical(markdown, service.markdownReaders);
                const selection = $getSelection();
                const nodes = $generateNodesFromSerializedNodes(root.children);
                logger.debug('INSERT_MARKDOWN_COMMAND nodes:', nodes);
                $insertGeneratedNodes(editor, nodes, selection!);
                return true;
              } catch (error) {
                logger.error('Failed to handle markdown paste:', error);
              }
            },
            { tag: HISTORY_PUSH_TAG },
          );
        }, 0);
        return false;
      },
      COMMAND_PRIORITY_HIGH, // Priority
    ),
    editor.registerCommand(
      GET_MARKDOWN_SELECTION_COMMAND,
      (payload) => {
        const newEditor = kernel.cloneNodeEditor();
        const sourceEditor = kernel.getLexicalEditor();
        const selection = kernel.getSelection();
        const targetEditor = newEditor.getLexicalEditor();
        const mappedSelection =
          sourceEditor && targetEditor && selection
            ? mapSelectionToEditor(selection, sourceEditor, targetEditor)
            : null;
        if (mappedSelection && targetEditor) {
          newEditor.setSelection(mappedSelection);
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
