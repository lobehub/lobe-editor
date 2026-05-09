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

/**
 * Markdown 特征检测 - 判断文本是否看起来像 Markdown
 * 返回检测到的 Markdown 特征数量
 */
function detectMarkdownFeatures(text: string): number {
  let score = 0;

  // 标题特征: #, ##, ### 等 - 单独一行标题是很强的 Markdown 特征
  if (/^#{1,6}\s+\S+/m.test(text)) score += 3;

  // 粗体/斜体特征: **text**, __text__, *text*, _text_
  if (/(\*\*|__)[\S\s]+?\1/.test(text)) score += 2;
  if (/([*_])[\S\s]+?\1/.test(text)) score += 1;

  // 删除线: ~~text~~
  if (/~~[\S\s]+?~~/.test(text)) score += 2;

  // 行内代码: `code`
  if (/`[^`]+`/.test(text)) score += 2;

  // 代码块: ```language ... ```
  if (/^```[\w+-]*\s*$/m.test(text) && /^```\s*$/m.test(text)) score += 4;

  // 链接: [text](url)
  if (/\[.+?]\s*\([^)]+\)/.test(text)) score += 2;

  // 图片: ![alt](url)
  if (/!\[.*?]\s*\([^)]+\)/.test(text)) score += 2;

  // 无序列表: -, *, + 开头
  if (/^[*+-]\s+\S+/m.test(text)) score += 2;

  // 有序列表: 1. 2. 等
  if (/^\d+\.\s+\S+/m.test(text)) score += 2;

  // 引用: > text
  if (/^>\s+\S+/m.test(text)) score += 2;

  // 分割线: ---, ___, ***
  if (/^[*_-]{3,}\s*$/m.test(text)) score += 2;

  // 表格特征: | 列1 | 列2 |  或者 |---|
  if (/^\|.*\|/.test(text) && /^\|[:-]+\|/.test(text)) score += 3;

  return score;
}

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
  /**
   * Callback when markdown is detected in pasted text.
   * If provided, the paste is intercepted and the callback decides whether to convert.
   * Return `true` to convert to markdown nodes, `false` to paste as plain text.
   * Supports async (Promise<boolean>) for confirmation dialogs.
   */
  onPasteMarkdown?: (text: string) => boolean | Promise<boolean>;
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

          if (this.service.runTransformers(parentNode, anchorNode, selection.anchor.offset)) {
            this.kernel.emit('markdownTransform', { trigger: 'type' });
          }
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
              this.kernel.emit('markdownTransform', { trigger: 'enter' });
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

          // 代码块内粘贴：跳过 markdown 转换（避免光标跳转）
          const isInCodeBlock = editor.getEditorState().read(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return false;
            const anchorNode = selection.anchor.getNode();
            if (!anchorNode) return false;
            // 检查当前节点或父节点是否为代码节点
            return $isCodeNode(anchorNode) || $isCodeNode(anchorNode.getParent());
          });
          if (isInCodeBlock) return false;

          const clipboardData = event.clipboardData;
          if (!clipboardData) return false;

          // Get clipboard content and clean BOM/zero-width characters
          const rawText = clipboardData.getData('text/plain').trimEnd();
          // Remove BOM, zero-width spaces, and other invisible characters
          const text = rawText.replaceAll(/[\u200B-\u200D\u2060\uFEFF]/g, '');

          // If there's no text content, let Lexical handle it
          if (!text) return false;

          // If confirmation callback is provided, intercept paste for user decision
          // (bypass hasRichHTML — user explicitly wants to be asked)
          if (this.config?.onPasteMarkdown) {
            event.preventDefault();
            event.stopPropagation();

            const historyState = this.kernel.getHistoryState().current;
            Promise.resolve(this.config.onPasteMarkdown(text)).then((confirmed) => {
              if (confirmed) {
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
              } else {
                editor.update(() => {
                  const selection = $getSelection();
                  if ($isRangeSelection(selection)) {
                    selection.insertRawText(text);
                  }
                });
              }
            });
            return true;
          }

          if (this.hasRichHTML(clipboardData)) {
            return false;
          }

          // Bare URLs (no markdown syntax) should stay as plain text
          if (/^https?:\/\/\S+$/i.test(text)) {
            return false;
          }

          // Markdown 特征检测 - 智能处理策略
          const score = detectMarkdownFeatures(text);
          if (score < 2) {
            // 明显不是 markdown，按纯文本处理
            return false;
          }

          // 弱 markdown 特征（2~5分）：不自动转换，按纯文本（避免误转换）
          if (score < 6) {
            return false;
          }

          // 强 markdown 特征（≥6分）：自动转换
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
              score,
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
};
