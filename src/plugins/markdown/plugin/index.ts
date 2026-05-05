import {
  $getClipboardDataFromSelection,
  setLexicalClipboardDataTransfer,
} from '@lexical/clipboard';
import { $isCodeNode } from '@lexical/code-core';
import {
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COLLABORATION_TAG,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_LOW,
  COPY_COMMAND,
  HISTORIC_TAG,
  KEY_ENTER_COMMAND,
  LexicalEditor,
  PASTE_COMMAND,
} from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor, IServiceID } from '@/types';
import { createDebugLogger } from '@/utils/debug';

import { INSERT_MARKDOWN_COMMAND, registerMarkdownCommand } from '../command';
import MarkdownDataSource from '../data-source/markdown-data-source';
import { IMarkdownShortCutService, MarkdownShortCutService } from '../service/shortcut';
import { canContainTransformableMarkdown } from '../utils';

/**
 * Plain-text Mermaid / diagram snippets look like “multi-paragraph Markdown” (blank lines → high score)
 * but must not go through markdown paste auto-convert — it breaks diagrams and fenced-code expectations.
 */
export function looksLikeMermaidDiagramSyntax(text: string): boolean {
  const normalized = text.replaceAll(/[\u200B-\u200D\u2060\uFEFF]/g, '').trimStart();

  if (
    /^(?:flowchart|graph)\s+\w+/im.test(normalized) ||
    /^(?:sequencediagram|classdiagram|statediagram(?:-v2)?|erdiagram|mindmap|timeline|pie|gitgraph|journey)\b/im.test(
      normalized,
    )
  ) {
    return true;
  }

  // subgraph blocks + diagram edge arrows strongly correlate with Mermaid DSL, not prose Markdown
  if (/\bsubgraph\s+/i.test(text) && /\s(?:-->|-\.->|===)/.test(text)) {
    return true;
  }

  return false;
}

const RICH_HTML_SELECTOR =
  'strong,em,b,i,h1,h2,h3,h4,h5,h6,ul,ol,table,img,blockquote,pre>code,a[href]';

export interface MarkdownPluginOptions {
  /**
   * Automatically convert pasted markdown once the detection threshold is reached
   * @default true
   */
  autoFormatMarkdown?: boolean;
  /**
   * Enable automatic markdown conversion for pasted content
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
  private markdownDataSource: MarkdownDataSource;
  private service: MarkdownShortCutService;

  constructor(
    protected kernel: IEditorKernel,
    public config?: MarkdownPluginOptions,
  ) {
    super();
    this.service = new MarkdownShortCutService(kernel);
    kernel.registerService(IMarkdownShortCutService, this.service);
    this.markdownDataSource = new MarkdownDataSource(
      'markdown',
      this.service,
      <T>(serviceId: IServiceID<T>) => {
        return kernel.requireService(serviceId);
      },
    );
    kernel.registerDataSource(this.markdownDataSource);
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
          const ret = editor.getEditorState().read(() => {
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
          if (!this.shouldHandlePasteMarkdown()) return false;

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

          if (this.hasRichHTML(clipboardData)) {
            this.logger.debug('rich HTML detected, skipping markdown auto-convert');
            return false;
          }

          // Bare URLs (no markdown syntax) should stay as plain text
          if (/^https?:\/\/\S+$/i.test(text)) {
            return false;
          }

          const historyState = this.kernel.getHistoryState().current;
          setTimeout(() => {
            editor.dispatchCommand(INSERT_MARKDOWN_COMMAND, {
              historyState,
              markdown: text,
            });
            this.kernel.emit('markdownParse', {
              cacheState: editor.getEditorState(),
              historyState,
              markdown: text,
              matchedPatterns: [],
              score: 0,
            });
          }, 10);

          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    );

    this.register(registerMarkdownCommand(editor, this.kernel, this.service));

    // Register COPY_COMMAND handler to set text/plain as markdown
    // This runs before Lexical's default EDITOR handler, handles the copy fully,
    // and returns true to prevent Lexical from overwriting text/plain with unformatted text
    this.register(
      editor.registerCommand(
        COPY_COMMAND,
        (event) => {
          if (!(event instanceof ClipboardEvent)) return false;

          const clipboardData = event.clipboardData;
          if (!clipboardData) return false;

          const selection = $getSelection();
          if (!selection || selection.isCollapsed()) return false;

          // Get the selection as markdown
          const markdown = this.markdownDataSource.write(editor, { selection: true });
          if (!markdown) return false;

          event.preventDefault();

          // Get HTML and Lexical JSON from Lexical's clipboard utilities
          const data = $getClipboardDataFromSelection(selection);

          // Set all Lexical clipboard data (text/html, application/x-lexical-editor)
          setLexicalClipboardDataTransfer(clipboardData, data);

          // Override text/plain with markdown and add text/markdown
          clipboardData.setData('text/plain', markdown);
          clipboardData.setData('text/markdown', markdown);

          this.logger.debug('copy with text/markdown:', { markdownLength: markdown.length });

          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }

  private hasRichHTML(clipboardData: DataTransfer) {
    const html = clipboardData.getData('text/html');

    if (!html) return false;
    if (/data-vscode|vscode-/i.test(html)) return false;
    if (typeof DOMParser === 'undefined') return false;

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const richTags = doc.body.querySelectorAll(RICH_HTML_SELECTOR);

    return richTags.length > 0;
  }

  private shouldHandlePasteMarkdown() {
    if (this.config?.enablePasteMarkdown === false) {
      return false;
    }

    return this.config?.autoFormatMarkdown !== false;
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
