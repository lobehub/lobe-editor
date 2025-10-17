import { $isCodeNode } from '@lexical/code';
import {
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COLLABORATION_TAG,
  COMMAND_PRIORITY_CRITICAL,
  HISTORIC_TAG,
  KEY_ENTER_COMMAND,
  LexicalEditor,
  PASTE_COMMAND,
} from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';
import { createDebugLogger } from '@/utils/debug';

import { registerMarkdownCommand } from '../command';
import MarkdownDataSource from '../data-source/markdown-data-source';
import { IMarkdownShortCutService, MarkdownShortCutService } from '../service/shortcut';
import { canContainTransformableMarkdown } from '../utils';

export interface MarkdownPluginOptions {
  /**
   * Enable automatic markdown formatting for pasted content
   * @default true
   */
  enablePasteMarkdown?: boolean;
}

export const MarkdownPlugin: IEditorPluginConstructor<MarkdownPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<MarkdownPluginOptions>
{
  static pluginName = 'MarkdownPlugin';
  private logger = createDebugLogger('plugin', 'markdown');
  private service: MarkdownShortCutService;

  constructor(
    protected kernel: IEditorKernel,
    public config?: MarkdownPluginOptions,
  ) {
    super();
    this.service = new MarkdownShortCutService(kernel);
    kernel.registerService(IMarkdownShortCutService, this.service);
    // @todo To be implemented
    kernel.registerDataSource(new MarkdownDataSource('markdown', this.service));
  }

  onInit(editor: LexicalEditor): void {
    this.register(
      editor.registerUpdateListener(({ tags, dirtyLeaves, editorState, prevEditorState }) => {
        // Ignore updates from collaboration and undo/redo (as changes already calculated)
        if (tags.has(COLLABORATION_TAG) || tags.has(HISTORIC_TAG)) {
          return;
        }

        // If editor is still composing (i.e. backticks) we must wait before the user confirms the key
        if (editor.isComposing()) {
          return;
        }

        const selection = editorState.read($getSelection);
        const prevSelection = prevEditorState.read($getSelection);

        // We expect selection to be a collapsed range and not match previous one (as we want
        // to trigger transforms only as user types)
        if (
          !$isRangeSelection(prevSelection) ||
          !$isRangeSelection(selection) ||
          !selection.isCollapsed() ||
          selection.is(prevSelection)
        ) {
          return;
        }

        const anchorKey = selection.anchor.key;
        const anchorOffset = selection.anchor.offset;

        const anchorNode = editorState._nodeMap.get(anchorKey);

        if (
          !$isTextNode(anchorNode) ||
          !dirtyLeaves.has(anchorKey) ||
          (anchorOffset !== 1 && anchorOffset > prevSelection.anchor.offset + 1)
        ) {
          return;
        }

        editor.update(() => {
          if (!canContainTransformableMarkdown(anchorNode)) {
            return;
          }

          const parentNode = anchorNode.getParent();

          if (parentNode === null || $isCodeNode(parentNode)) {
            return;
          }

          this.service.runTransformers(parentNode, anchorNode, selection.anchor.offset);
        });
      }),
    );

    this.register(
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (payload) => {
          const ret = editor.read(() => {
            const selection = $getSelection();

            if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
              return false;
            }

            const anchorKey = selection.anchor.key;

            const anchorNode = $getNodeByKey(anchorKey);

            if (!anchorNode) return false;

            return {
              anchorNode,
              offset: selection.anchor.offset,
            };
          });

          if (!ret) return false;

          const { anchorNode, offset } = ret;

          if (!canContainTransformableMarkdown(anchorNode)) {
            return false;
          }

          const parentNode = anchorNode.getParent();

          if (parentNode === null || $isCodeNode(parentNode)) {
            return false;
          }

          if (this.service.testTransformers(parentNode, anchorNode, offset, 'enter')) {
            queueMicrotask(() => {
              editor.update(() => {
                this.service.runTransformers(parentNode, anchorNode, offset, 'enter');
              });
            });
            payload?.stopPropagation();
            payload?.stopImmediatePropagation();
            payload?.preventDefault();
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    );

    this.register(
      editor.registerCommand(
        PASTE_COMMAND,
        (event) => {
          if (!(event instanceof ClipboardEvent)) return false;

          const clipboardData = event.clipboardData;
          if (!clipboardData) return false;

          // Get clipboard content
          const text = clipboardData.getData('text/plain');
          const html = clipboardData.getData('text/html');

          // If there's no text content, let Lexical handle it
          if (!text) return false;

          // Check if markdown paste formatting is enabled (default: true)
          const enablePasteMarkdown = this.config?.enablePasteMarkdown ?? true;

          this.logger.debug('paste content analysis:', {
            enablePasteMarkdown,
            hasHTML: !!(html && html.trim()),
            text: text.slice(0, 100) + (text.length > 100 ? '...' : ''),
          });

          // Always force plain text paste first (prevents HTML formatting issues)
          event.preventDefault();
          event.stopPropagation();

          editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;

            // Insert plain text
            selection.insertText(text);
          });

          // If markdown formatting is disabled, we're done
          if (!enablePasteMarkdown) {
            this.logger.debug('markdown formatting disabled, plain text inserted');
            return true;
          }

          // Check if the pasted plain text contains markdown patterns
          const hasMarkdownContent = this.detectMarkdownContent(text);

          if (hasMarkdownContent) {
            // Markdown detected - show confirmation dialog
            this.logger.debug('markdown patterns detected:', this.getMarkdownPatterns(text));

            setTimeout(() => {
              this.kernel.emit('markdownParse', {
                cacheState: editor.getEditorState(),
                markdown: text,
              });
            }, 10);
          } else {
            // No markdown detected - plain text is already inserted
            this.logger.debug('no markdown patterns detected, keeping as plain text');
          }

          return true; // Command handled
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    );

    this.register(registerMarkdownCommand(editor, this.service));
  }

  /**
   * Detect if text contains markdown patterns
   * Returns false if content is likely code (JSON, HTML, SQL, etc.)
   */
  private detectMarkdownContent(text: string): boolean {
    const trimmed = text.trim();

    // Check if content is JSON
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        JSON.parse(trimmed);
        this.logger.debug('content is valid JSON, not treating as markdown');
        return false;
      } catch {
        // Not valid JSON, continue checking
      }
    }

    // Check if content has significant HTML structure
    const htmlTagPattern = /<[a-z][\S\s]*?>/gi;
    const htmlMatches = text.match(htmlTagPattern);

    if (htmlMatches && htmlMatches.length > 5) {
      // More than 5 HTML tags suggests this is HTML content, not markdown
      this.logger.debug('content has significant HTML structure, not treating as markdown');
      return false;
    }

    // Check if content looks like code (SQL, XML, etc.)
    // Common patterns: SQL keywords, XML declarations, file paths
    const codePatterns = [
      /^\s*(select|insert|update|delete|create|alter|drop)\s+/im, // SQL
      /^\s*<\?xml/i, // XML declaration
      /^[a-z]:\\|^\/[a-z]/im, // File paths (Windows/Unix)
    ];

    if (codePatterns.some((pattern) => pattern.test(text))) {
      this.logger.debug('content looks like code, not treating as markdown');
      return false;
    }

    const markdownPatterns = [
      // Headers
      /^#{1,6}\s+/m,
      // Bold/italic
      /\*{1,2}[^*]+\*{1,2}/,
      /__?[^_]+__?/,
      // Code blocks
      /```[\S\s]*```/,
      // Inline code
      /`[^`]+`/,
      // Links
      /\[[^\]]*]\([^)]+\)/,
      // Images
      /!\[[^\]]*]\([^)]+\)/,
      // Lists
      /^[*+-]\s+/m,
      /^\d+\.\s+/m,
      // Blockquotes
      /^>\s+/m,
      // Tables
      /\|.*\|.*\|/,
      // Horizontal rules
      /^---+$/m,
      /^\*\*\*+$/m,
      // Strikethrough
      /~~[^~]+~~/,
    ];

    return markdownPatterns.some((pattern) => pattern.test(text));
  }

  /**
   * Get specific markdown patterns found in text
   */
  private getMarkdownPatterns(text: string): string[] {
    const patterns: { name: string; regex: RegExp }[] = [
      { name: 'headers', regex: /^#{1,6}\s+/m },
      { name: 'bold', regex: /\*{2}[^*]+\*{2}/ },
      { name: 'italic', regex: /\*[^*]+\*/ },
      { name: 'code-blocks', regex: /```[\S\s]*```/ },
      { name: 'inline-code', regex: /`[^`]+`/ },
      { name: 'links', regex: /\[[^\]]*]\([^)]+\)/ },
      { name: 'images', regex: /!\[[^\]]*]\([^)]+\)/ },
      { name: 'lists', regex: /^[*+-]\s+/m },
      { name: 'ordered-lists', regex: /^\d+\.\s+/m },
      { name: 'blockquotes', regex: /^>\s+/m },
      { name: 'tables', regex: /\|.*\|.*\|/ },
      { name: 'horizontal-rules', regex: /^---+$/m },
      { name: 'strikethrough', regex: /~~[^~]+~~/ },
    ];

    return patterns.filter(({ regex }) => regex.test(text)).map(({ name }) => name);
  }

  // /**
  //  * Handle markdown paste by parsing and inserting as structured content
  //  */
  // private handleMarkdownPaste(editor: LexicalEditor, text: string): boolean {
  //   try {
  //     // Use the markdown data source to parse the content
  //     const root = parseMarkdownToLexical(text, this.service.markdownReaders);
  //     const selection = $getSelection();
  //     const nodes = $generateNodesFromSerializedNodes(root.children);
  //     $insertGeneratedNodes(editor, nodes, selection!);
  //     return true;
  //   } catch (error) {
  //     this.logger.error('Failed to handle markdown paste:', error);
  //   }

  //   return false;
  // }
};
