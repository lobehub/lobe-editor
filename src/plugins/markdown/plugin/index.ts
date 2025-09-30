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

import MarkdownDataSource from '../data-source/markdown-data-source';
import { parseMarkdownToLexical } from '../data-source/markdown/parse';
import { IMarkdownShortCutService, MarkdownShortCutService } from '../service/shortcut';
import {
  $generateNodesFromSerializedNodes,
  $insertGeneratedNodes,
  canContainTransformableMarkdown,
} from '../utils';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface MarkdownPluginOptions {}

export const MarkdownPlugin: IEditorPluginConstructor<MarkdownPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<MarkdownPluginOptions>
{
  static pluginName = 'MarkdownPlugin';
  private service: MarkdownShortCutService;

  constructor(protected kernel: IEditorKernel) {
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

          // If there's HTML content, it's a rich text paste
          // Let Lexical's rich text handler process it
          if (html && html.trim()) {
            console.log('paste content analysis: HTML detected, letting Lexical handle it');
            return false;
          }

          // Only handle plain text paste - check for markdown patterns
          const hasMarkdownContent = this.detectMarkdownContent(text);

          console.log('paste content analysis:', {
            hasHTML: false,
            hasMarkdown: hasMarkdownContent,
            markdownPatterns: this.getMarkdownPatterns(text),
            text: text.slice(0, 100) + (text.length > 100 ? '...' : ''),
          });

          if (hasMarkdownContent) {
            // Handle markdown paste
            return this.handleMarkdownPaste(editor, text);
          }

          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    );
  }

  /**
   * Detect if text contains markdown patterns
   */
  private detectMarkdownContent(text: string): boolean {
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

  /**
   * Handle markdown paste by parsing and inserting as structured content
   */
  private handleMarkdownPaste(editor: LexicalEditor, text: string): boolean {
    try {
      // Use the markdown data source to parse the content
      const root = parseMarkdownToLexical(text, this.service.markdownReaders);
      const selection = $getSelection();
      const nodes = $generateNodesFromSerializedNodes(root.children);
      $insertGeneratedNodes(editor, nodes, selection!);
      return true;
    } catch (error) {
      console.error('Failed to handle markdown paste:', error);
    }

    return false;
  }
};
