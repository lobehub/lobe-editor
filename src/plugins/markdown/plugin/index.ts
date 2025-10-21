import { $createCodeNode, $isCodeHighlightNode, $isCodeNode } from '@lexical/code';
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
import { $isCodeInlineNode } from '@/plugins/code/node/code';
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';
import { createDebugLogger } from '@/utils/debug';

import { registerMarkdownCommand } from '../command';
import MarkdownDataSource from '../data-source/markdown-data-source';
import { IMarkdownShortCutService, MarkdownShortCutService } from '../service/shortcut';
import { canContainTransformableMarkdown } from '../utils';
import { detectCodeLanguage, detectLanguage } from '../utils/detectLanguage';
import { isValidUrl as isValidLinkUrl } from '../utils/url-validator';

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

          // Get clipboard content and clean BOM/zero-width characters
          const rawText = clipboardData.getData('text/plain').trimEnd();
          // Remove BOM, zero-width spaces, and other invisible characters
          const text = rawText.replaceAll(/[\u200B-\u200D\u2060\uFEFF]/g, '');
          const html = clipboardData.getData('text/html').trimEnd();

          // If there's no text content, let Lexical handle it
          if (!text) return false;

          this.logger.debug('paste content analysis:', {
            clipboardTypes: Array.from(clipboardData.types || []),
            hasHTML: !!(html && html.trim()),
            htmlLength: html?.length || 0,
            textLength: text.length,
          });

          // Check if cursor is inside code block or inline code
          // If so, always paste as plain text
          const isInCodeBlock = editor.read(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return false;

            const anchorNode = selection.anchor.getNode();
            const focusNode = selection.focus.getNode();

            // Check if in code block (CodeNode or CodeHighlightNode)
            const anchorParent = anchorNode.getParent();
            const focusParent = focusNode.getParent();

            if ($isCodeNode(anchorNode) || $isCodeNode(focusNode)) {
              return true;
            }

            if ($isCodeNode(anchorParent) || $isCodeNode(focusParent)) {
              return true;
            }

            if ($isCodeHighlightNode(anchorNode) || $isCodeHighlightNode(focusNode)) {
              return true;
            }

            // Check if in inline code
            if ($isCodeInlineNode(anchorNode) || $isCodeInlineNode(focusNode)) {
              return true;
            }

            if ($isCodeInlineNode(anchorParent) || $isCodeInlineNode(focusParent)) {
              return true;
            }

            return false;
          });

          if (isInCodeBlock) {
            this.logger.debug('cursor in code block, pasting as plain text');
            event.preventDefault();
            event.stopPropagation();

            editor.update(() => {
              const selection = $getSelection();
              if (!$isRangeSelection(selection)) return;

              selection.insertText(text);
            });

            return true;
          }

          const enablePasteMarkdown = this.config?.enablePasteMarkdown ?? true;

          // If markdown formatting is disabled, we're done
          if (!enablePasteMarkdown) {
            // Force plain text paste for external content
            event.preventDefault();
            event.stopPropagation();

            editor.update(() => {
              const selection = $getSelection();
              if (!$isRangeSelection(selection)) return;

              // Insert plain text
              selection.insertText(text);
            });
            this.logger.debug('markdown formatting disabled, plain text inserted');
            return true;
          }

          // Check if this is likely a rich-text paste from the editor or other rich editor
          // Rich text pastes typically have HTML that's more complex than just wrapping text
          if (clipboardData.types.includes('application/x-lexical-editor')) {
            this.logger.debug('rich content detected, letting Lexical handle paste');
            return false;
          }

          // Check if markdown paste formatting is enabled (default: true)
          // Note: URL pasting is handled by Link/LinkHighlight plugins themselves

          // Check if content is code (JSON, SQL, etc.) and should be inserted as code block
          const codeInfo = this.detectCodeContent(text);

          if (codeInfo) {
            // Code detected - insert as code block
            this.logger.debug(`code detected (${codeInfo.language}), inserting as code block`);

            event.preventDefault();
            event.stopPropagation();

            editor.update(() => {
              const selection = $getSelection();
              if (!$isRangeSelection(selection)) return;

              // Create code block node with detected language
              const codeNode = $createCodeNode(codeInfo.language);
              selection.insertNodes([codeNode]);

              // Insert the code text into the code block
              codeNode.select();
              const codeSelection = $getSelection();
              if ($isRangeSelection(codeSelection)) {
                codeSelection.insertText(text);
              }
            });

            return true; // Command handled
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

          if (
            clipboardData.types.includes('text/html') &&
            clipboardData.types.includes('text/rtf')
          ) {
            // Code detected - insert as code block
            this.logger.debug(`code like, inserting as code block`);

            event.preventDefault();
            event.stopPropagation();

            editor.update(() => {
              const selection = $getSelection();
              if (!$isRangeSelection(selection)) return;

              // Create code block node with detected language
              const codeNode = $createCodeNode('plaintext');
              selection.insertNodes([codeNode]);

              // Insert the code text into the code block
              codeNode.select();
              const codeSelection = $getSelection();
              if ($isRangeSelection(codeSelection)) {
                codeSelection.insertText(text);
              }
            });

            return true; // Command handled
          }

          // Check if the pasted content is a pure URL
          // If so, let Link/LinkHighlight plugins handle it
          if (
            clipboardData.types.length === 1 &&
            clipboardData.types[0] === 'text/plain' &&
            isValidLinkUrl(text)
          ) {
            this.logger.debug('pure URL detected, letting Link/LinkHighlight plugins handle');
            return false; // Let other plugins handle URL paste
          }

          // Force plain text paste for external content
          event.preventDefault();
          event.stopPropagation();

          editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;

            // Insert plain text
            selection.insertText(text);
          });

          return true; // Command handled
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    );

    this.register(registerMarkdownCommand(editor, this.service));
  }

  /**
   * Detect if content is code and should be inserted as code block
   * Uses advanced language detection with pattern matching
   * Excludes markdown as it should be handled by markdown formatting dialog
   */
  private detectCodeContent(text: string): { confidence: number; language: string } | null {
    // Use the advanced language detector
    const detected = detectLanguage(text);

    if (detected && detected.confidence > 50) {
      // Don't insert markdown as code block - it should trigger the formatting dialog
      if (detected.language === 'markdown') {
        return null;
      }

      this.logger.debug('language detected:', detected);
      return detected;
    }

    // Fallback to fast detection for common formats
    const fastDetected = detectCodeLanguage(text);
    if (fastDetected) {
      // Don't insert markdown as code block
      if (fastDetected === 'markdown') {
        return null;
      }
      return { confidence: 80, language: fastDetected };
    }

    return null;
  }

  /**
   * Detect if text contains markdown patterns
   * Returns false if content is likely code (will be handled by detectCodeContent)
   */
  private detectMarkdownContent(text: string): boolean {
    // If code is detected, don't treat as markdown
    if (this.detectCodeContent(text)) {
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
