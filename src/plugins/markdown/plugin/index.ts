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
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor, IServiceID } from '@/types';
import { createDebugLogger } from '@/utils/debug';

import { INSERT_MARKDOWN_COMMAND, registerMarkdownCommand } from '../command';
import MarkdownDataSource from '../data-source/markdown-data-source';
import { IMarkdownShortCutService, MarkdownShortCutService } from '../service/shortcut';
import { canContainTransformableMarkdown } from '../utils';
import { detectCodeLanguage, detectLanguage } from '../utils/detectLanguage';

const DEFAULT_PASTE_MARKDOWN_AUTO_CONVERT_THRESHOLD = 5;

interface MarkdownDetectionRule {
  name: string;
  score: number;
  test: (text: string) => boolean;
}

interface MarkdownDetectionResult {
  matchedPatterns: string[];
  score: number;
  shouldAutoConvert: boolean;
}

const RICH_HTML_SELECTOR =
  'strong,em,b,i,h1,h2,h3,h4,h5,h6,ul,ol,table,img,blockquote,pre>code,a[href]';

const MARKDOWN_DETECTION_RULES = [
  { name: 'headers', score: 5, test: (text) => /^#{1,6}\s+\S/m.test(text) },
  { name: 'code-fence-start', score: 5, test: (text) => /^```[\w-]*$/m.test(text) },
  { name: 'links', score: 4, test: (text) => /\[[^\]]+]\([^)]+\)/.test(text) },
  { name: 'images', score: 5, test: (text) => /!\[[^\]]*]\([^)]+\)/.test(text) },
  {
    name: 'tables',
    score: 5,
    test: (text) => /^\|.+\|$/m.test(text) && /^\|[\s:|-]+\|$/m.test(text),
  },
  {
    name: 'admonitions',
    score: 5,
    test: (text) => /^>\s*\[!(?:note|tip|warning|caution|important)]/im.test(text),
  },
  {
    name: 'task-lists',
    score: 4,
    test: (text) => /^[*-]\s+\[[ x]]/m.test(text),
  },
  { name: 'bold', score: 2, test: (text) => /\*\*.+?\*\*/.test(text) },
  {
    name: 'italic',
    score: 1,
    test: (text) => /(?<!\*)\*(?!\*)(?!\s).+?(?<!\s)(?<!\*)\*(?!\*)/.test(text),
  },
  { name: 'unordered-lists', score: 1, test: (text) => /^[*+-]\s+\S/m.test(text) },
  { name: 'ordered-lists', score: 1, test: (text) => /^\d+\.\s+\S/m.test(text) },
  { name: 'blockquotes', score: 1, test: (text) => /^>\s+\S/m.test(text) },
  { name: 'inline-code', score: 1, test: (text) => /`.+?`/.test(text) },
  {
    name: 'horizontal-rules',
    score: 2,
    test: (text) => /^[*_-]{3,}$/m.test(text),
  },
  {
    name: 'multi-paragraph',
    score: 5,
    test: (text) => text.split(/\n{2,}/).filter(Boolean).length >= 2,
  },
  { name: 'short-text-penalty', score: -3, test: (text) => text.length < 20 },
  { name: 'single-line-penalty', score: -2, test: (text) => !text.includes('\n') },
] as const satisfies MarkdownDetectionRule[];

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
   * Minimum markdown score required before auto conversion runs
   * @default 5
   */
  pasteMarkdownAutoConvertThreshold?: number;
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
    kernel.registerDataSource(
      new MarkdownDataSource('markdown', this.service, <T>(serviceId: IServiceID<T>) => {
        return kernel.requireService(serviceId);
      }),
    );
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

          const detectionResult = this.getMarkdownDetectionResult(text);

          if (detectionResult.shouldAutoConvert) {
            this.logger.debug('markdown auto-convert detected:', detectionResult);

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
                matchedPatterns: detectionResult.matchedPatterns,
                score: detectionResult.score,
              });
            }, 10);
          } else {
            this.logger.debug(
              'markdown score below auto-convert threshold, keeping as plain text:',
              detectionResult,
            );
          }

          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    );

    this.register(registerMarkdownCommand(editor, this.kernel, this.service));
  }

  /**
   * Detect if content is code and should be inserted as code block
   * Uses advanced language detection with pattern matching
   * Excludes markdown because markdown content is handled by the paste auto-convert flow
   */
  private detectCodeContent(text: string): { confidence: number; language: string } | null {
    // Use the advanced language detector
    const detected = detectLanguage(text);

    if (detected && detected.confidence > 50) {
      // Don't insert markdown as code block - it should use the markdown auto-convert flow
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

  private hasRichHTML(clipboardData: DataTransfer) {
    const html = clipboardData.getData('text/html');

    if (!html) return false;
    if (/data-vscode|vscode-/i.test(html)) return false;
    if (typeof DOMParser === 'undefined') return false;

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const richTags = doc.body.querySelectorAll(RICH_HTML_SELECTOR);

    return richTags.length > 0;
  }

  /**
   * Analyze pasted text and determine whether it should auto convert to markdown
   */
  private getMarkdownDetectionResult(text: string): MarkdownDetectionResult {
    if (this.detectCodeContent(text)) {
      return {
        matchedPatterns: [],
        score: 0,
        shouldAutoConvert: false,
      };
    }

    const matchedPatterns: string[] = [];
    let score = 0;
    const threshold = this.getPasteMarkdownAutoConvertThreshold();

    for (const rule of MARKDOWN_DETECTION_RULES) {
      if (!rule.test(text)) continue;

      matchedPatterns.push(rule.name);
      score += rule.score;
    }

    return {
      matchedPatterns,
      score,
      shouldAutoConvert: score >= threshold,
    };
  }

  private getPasteMarkdownAutoConvertThreshold() {
    const threshold = this.config?.pasteMarkdownAutoConvertThreshold;

    if (typeof threshold !== 'number' || Number.isNaN(threshold)) {
      return DEFAULT_PASTE_MARKDOWN_AUTO_CONVERT_THRESHOLD;
    }

    return Math.max(1, threshold);
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
