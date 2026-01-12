import {
  $createNodeSelection,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  $setSelection,
  CONTROLLED_TEXT_INSERTION_COMMAND,
} from 'lexical';
import type { LexicalEditor } from 'lexical';

import { $createCodeMirrorNode } from '@/plugins/codemirror-block/node/CodeMirrorNode';

// ============================================================================
// Paste Middleware Types
// ============================================================================

/**
 * Configuration options relevant to paste handling
 */
export interface PasteHandlerConfig {
  pasteVSCodeAsCodeBlock?: boolean;
}

export interface PasteContext {
  clipboardData: DataTransfer;
  config: PasteHandlerConfig;
  editor: LexicalEditor;
  event: ClipboardEvent;
}

/**
 * Paste handler function type.
 * @returns 'handled' - stop the chain, event is handled
 * @returns 'skip' - skip pasteAsPlainText logic, let default behavior handle
 * @returns 'next' - continue to next handler
 */
export type PasteHandler = (ctx: PasteContext) => 'handled' | 'skip' | 'next';

// ============================================================================
// Paste Handlers
// ============================================================================

/**
 * Check if it's a file paste - skip plain text handling to let file uploads work normally
 */
export const handleFilePaste: PasteHandler = ({ clipboardData }) => {
  const items = clipboardData.items;
  for (const item of items) {
    if (item.kind === 'file') {
      return 'skip';
    }
  }
  return 'next';
};

/**
 * Handle VS Code paste - create code block with language from vscode-editor-data
 */
export const handleVSCodePaste: PasteHandler = ({ clipboardData, config, editor, event }) => {
  if (!config.pasteVSCodeAsCodeBlock) {
    return 'next';
  }

  const vscodeDataStr = clipboardData.getData('vscode-editor-data');

  if (!vscodeDataStr) {
    return 'next';
  }

  try {
    const vscodeData = JSON.parse(vscodeDataStr);
    // VS Code uses 'mode' for language, fallback to 'language' or 'plaintext'
    const language = vscodeData.mode || vscodeData.language || 'plaintext';
    const text = clipboardData.getData('text/plain');

    if (!text) {
      return 'next';
    }

    event.preventDefault();
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        return;
      }

      // Create CodeMirror node with language and text content
      const codeNode = $createCodeMirrorNode(language, text);
      $insertNodes([codeNode]);

      // Select the inserted CodeMirror node
      const nodeSelection = $createNodeSelection();
      nodeSelection.add(codeNode.getKey());
      $setSelection(nodeSelection);
    });

    return 'handled';
  } catch {
    // If parsing fails, continue to next handler
    return 'next';
  }
};

/**
 * Handle plain text paste - fallback handler that pastes as plain text
 */
export const handlePlainTextPaste: PasteHandler = ({ clipboardData, editor, event }) => {
  const text = clipboardData.getData('text/plain');
  if (!text) {
    return 'skip';
  }

  event.preventDefault();
  editor.dispatchCommand(CONTROLLED_TEXT_INSERTION_COMMAND, text);
  return 'handled';
};

// ============================================================================
// Middleware Runner
// ============================================================================

/**
 * Run paste handlers in sequence (middleware chain pattern)
 * @returns true if event was handled, false to let default behavior continue
 */
export function runPasteHandlers(ctx: PasteContext, handlers: PasteHandler[]): boolean {
  for (const handler of handlers) {
    const result = handler(ctx);
    if (result === 'handled') {
      return true;
    }
    if (result === 'skip') {
      return false;
    }
    // 'next' continues to the next handler
  }
  return false;
}
