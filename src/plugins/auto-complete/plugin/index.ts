import type { LexicalEditor } from 'lexical';
import {
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $setSelection,
  COMMAND_PRIORITY_HIGH,
  HISTORIC_TAG,
  HISTORY_PUSH_TAG,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
} from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import { IMarkdownShortCutService } from '@/plugins/markdown';
import { $generateNodesFromSerializedNodes } from '@/plugins/markdown/utils';
import type { IEditor, IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';
import { createDebugLogger } from '@/utils/debug';

import {
  $createPlaceholderNode,
  PlaceholderBlockNode,
  PlaceholderNode,
} from '../node/placeholderNode';
import { $readCompletionContext, type CompletionContext } from './context';

export interface AutoCompletePluginOptions {
  /** Delay in milliseconds before triggering auto-complete (default: 1000ms) */
  delay?: number;
  onAutoComplete?: (opt: {
    abortSignal: AbortSignal;
    afterText: string;
    editor: IEditor;
    input: string;
    selectionType: string;
    suggestionId?: string;
  }) => Promise<string | null>;
  onSuggestionAccepted?: (info: {
    acceptedText: string;
    suggestionId: string;
    visibleMs: number;
  }) => void;
  onSuggestionRejected?: (info: {
    reason: 'cursor-move' | 'typing' | 'esc' | 'blur' | 'other';
    suggestionId: string;
    visibleMs: number;
  }) => void;
  theme?: {
    /** Kept for rendering PlaceholderBlock nodes from older serialized documents. */
    placeholderBlock?: string;
    placeholderInline?: string;
  };
}

type Phase = 'idle' | 'waiting' | 'requesting' | 'visible' | 'composing' | 'settling' | 'destroyed';
type RejectReason = Parameters<
  NonNullable<AutoCompletePluginOptions['onSuggestionRejected']>
>[0]['reason'];
type Preview = {
  context: CompletionContext;
  id: string;
  key: string;
  markdown: string;
  rejected: boolean;
  shownAt: number;
};
const PREVIEW_TAG = 'auto-complete:preview';

export const AutoCompletePlugin: IEditorPluginConstructor<AutoCompletePluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<AutoCompletePluginOptions>
{
  static pluginName = 'AutoCompletePlugin';
  private logger = createDebugLogger('plugin', 'auto-complete');
  private phase: Phase = 'idle';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private request: AbortController | null = null;
  private preview: Preview | null = null;
  private lastContext: string | null = null;
  private suggestionCounter = 0;
  private editor: LexicalEditor | null = null;
  private markdownService: IMarkdownShortCutService | null = null;

  constructor(
    protected kernel: IEditorKernel,
    public config?: AutoCompletePluginOptions,
  ) {
    super();
    // New previews use PlaceholderNode; keep the old block type deserializable.
    kernel.registerNodes([PlaceholderNode, PlaceholderBlockNode]);
    if (config?.theme) kernel.registerThemes(config.theme);
  }

  onInit(editor: LexicalEditor): void {
    this.editor = editor;
    this.markdownService = this.kernel.requireService(IMarkdownShortCutService);
    if (!this.markdownService) return;

    // Observe native composition without dispatching an extra Lexical update.
    // Only the browser/Lexical owns preedit text and its replacement range.
    const startComposition = () => this.suspend();
    const endComposition = () => {
      this.phase = 'settling';
      this.scheduleSettlement();
    };
    const blur = () => this.dismiss('blur');
    const focus = () => {
      this.lastContext = null;
      this.schedule();
    };
    this.register(
      editor.registerRootListener((root, previous) => {
        previous?.removeEventListener('compositionstart', startComposition, true);
        previous?.removeEventListener('compositionend', endComposition, true);
        previous?.removeEventListener('blur', blur);
        previous?.removeEventListener('focus', focus);
        if (previous) {
          this.cancelRequest();
          this.cancelSettlement();
          this.lastContext = null;
          if (this.phase !== 'destroyed') this.phase = 'idle';
          this.removePreview();
        }
        root?.addEventListener('compositionstart', startComposition, true);
        root?.addEventListener('compositionend', endComposition, true);
        root?.addEventListener('blur', blur);
        root?.addEventListener('focus', focus);
        if (root && !previous) {
          // A detached editor has no DOM reconciliation to refresh root text
          // after removing its transient preview. Reconcile on reattachment.
          editor.update(() => $getRoot().markDirty(), { discrete: true, tag: PREVIEW_TAG });
        }
      }),
    );

    // One update listener owns invalidation. Preview updates never retrigger it.
    this.register(
      editor.registerUpdateListener(({ editorState, prevEditorState, tags }) => {
        if (this.phase === 'destroyed' || tags.has(PREVIEW_TAG)) return;
        if (editor.isComposing()) {
          this.suspend();
          return;
        }
        if (this.phase === 'composing' || this.phase === 'settling') {
          this.phase = 'settling';
          this.scheduleSettlement();
          return;
        }
        const context = editorState.read($readCompletionContext);
        if (this.preview) {
          if (context?.fingerprint === this.preview.context.fingerprint) return;
          const previous = prevEditorState.read($readCompletionContext);
          const textChanged =
            context?.input !== previous?.input || context?.afterText !== previous?.afterText;
          this.dismiss(textChanged ? 'typing' : 'cursor-move', true);
        } else this.schedule();
      }),
    );

    this.register(
      editor.registerCommand(
        KEY_TAB_COMMAND,
        (event) => {
          if (event?.isComposing || event?.shiftKey || !this.canAccept()) return false;
          event?.preventDefault();
          this.accept();
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    );
    this.register(
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        (event) => {
          if (event?.isComposing || !this.canAccept()) return false;
          event?.preventDefault();
          this.dismiss('esc');
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    );
  }

  private focused(): boolean {
    const root = this.editor?.getRootElement();
    return !!root && root.contains(root.ownerDocument.activeElement);
  }

  private cancelRequest(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.request?.abort();
    this.request = null;
  }

  private cancelSettlement(): void {
    if (this.settleTimer !== null) clearTimeout(this.settleTimer);
    this.settleTimer = null;
  }

  private suspend(): void {
    if (this.phase === 'destroyed') return;
    this.phase = 'composing';
    this.lastContext = null;
    this.cancelRequest();
    this.cancelSettlement();
    if (this.preview) {
      this.editor?.getElementByKey(this.preview.key)?.style.setProperty('display', 'none');
      this.reportRejection('other');
    }
  }

  private scheduleSettlement(): void {
    this.cancelSettlement();
    // Yield past the current native event, but do not treat a timer as proof
    // that composition finished. Safari may commit insertFromComposition in
    // a later task: isComposing() gates removal, and the update listener
    // re-arms settlement when Lexical finally releases its composition key.
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      if (this.phase !== 'settling' || this.editor?.isComposing()) return;
      this.removePreview(() => {
        if (this.phase !== 'settling') return;
        this.phase = 'idle';
        this.schedule();
      });
    }, 0);
  }

  private schedule(): void {
    if (
      !this.editor ||
      !this.focused() ||
      this.editor.isComposing() ||
      this.phase === 'composing' ||
      this.phase === 'settling' ||
      this.phase === 'destroyed' ||
      this.preview
    )
      return;
    const context = this.editor.getEditorState().read($readCompletionContext);
    if (context?.fingerprint === this.lastContext) return;
    this.cancelRequest();
    this.lastContext = context?.fingerprint ?? null;
    this.phase = context ? 'waiting' : 'idle';
    if (!context || !this.config?.onAutoComplete) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.fetchSuggestion(context);
    }, this.config.delay ?? 1000);
  }

  private async fetchSuggestion(context: CompletionContext): Promise<void> {
    if (!this.editor || !this.focused() || this.phase !== 'waiting') return;
    if (
      this.editor.getEditorState().read($readCompletionContext)?.fingerprint !== context.fingerprint
    )
      return;
    const controller = new AbortController();
    this.request = controller;
    this.phase = 'requesting';
    const id = `acp${++this.suggestionCounter}`;
    try {
      const markdown = await this.config?.onAutoComplete?.({
        abortSignal: controller.signal,
        afterText: context.afterText,
        editor: this.kernel as IEditor,
        input: context.input,
        selectionType: context.selectionType,
        suggestionId: id,
      });
      if (this.request !== controller || controller.signal.aborted || !this.focused()) return;
      this.request = null;
      this.phase = 'idle';
      if (markdown) this.showPreview(markdown, id, context);
    } catch (error) {
      if (this.request !== controller) return;
      this.request = null;
      this.phase = 'idle';
      this.logger.warn('Auto-complete request failed:', error);
    }
  }

  private showPreview(markdown: string, id: string, context: CompletionContext): void {
    const editor = this.editor!;
    // Flush earlier user updates with their own tags before starting a preview
    // transaction. `discrete` below also prevents later input joining this one.
    if (editor.read($readCompletionContext)?.fingerprint !== context.fingerprint) return;
    editor.update(
      () => {
        if (
          this.phase !== 'idle' ||
          editor.isComposing() ||
          !this.focused() ||
          $readCompletionContext()?.fingerprint !== context.fingerprint
        )
          return;
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        const parsed = this.markdownService!.parseMarkdownToLexical(markdown);
        const children = $generateNodesFromSerializedNodes(parsed.children);
        if (!children.length) return;
        const node = $createPlaceholderNode();
        const [first, ...rest] = children;
        // Keep the entire preview inside ONE inline wrapper. Its block children
        // take visual space without splitting the surrounding document paragraph.
        if ($isElementNode(first) && first.getType() === 'paragraph')
          node.append(...first.getChildren());
        else node.append(first);
        node.append(...rest);
        const caret = selection.clone();
        selection.insertNodes([node]);
        $setSelection(caret);
        const actualContext = $readCompletionContext();
        this.preview = {
          context: actualContext ?? context,
          id,
          key: node.getKey(),
          markdown,
          rejected: false,
          shownAt: Date.now(),
        };
        this.phase = 'visible';
      },
      { discrete: true, tag: [PREVIEW_TAG, HISTORIC_TAG] },
    );
  }

  private reportRejection(reason: RejectReason): void {
    const preview = this.preview;
    if (!preview || preview.rejected) return;
    preview.rejected = true;
    try {
      this.config?.onSuggestionRejected?.({
        reason,
        suggestionId: preview.id,
        visibleMs: Date.now() - preview.shownAt,
      });
    } catch (error) {
      this.logger.warn('Auto-complete rejection callback failed:', error);
    }
  }

  private dismiss(reason: RejectReason, restart = false): void {
    this.cancelRequest();
    this.reportRejection(reason);
    if (this.phase === 'composing' || this.phase === 'settling' || this.editor?.isComposing())
      return;
    this.phase = 'idle';
    this.removePreview(() => {
      if (restart) {
        this.lastContext = null;
        this.schedule();
      }
    });
  }

  private removePreview(done?: () => void): void {
    const preview = this.preview;
    if (!preview || !this.editor) {
      done?.();
      return;
    }
    let removed = false;
    this.editor.update(
      () => {
        if (this.editor!.isComposing() || this.phase === 'composing') {
          this.suspend();
          return;
        }
        $getNodeByKey(preview.key)?.remove();
        if (this.preview === preview) this.preview = null;
        removed = true;
      },
      {
        discrete: true,
        onUpdate: () => {
          if (removed) done?.();
        },
        tag: [PREVIEW_TAG, HISTORIC_TAG],
      },
    );
  }

  private canAccept(): boolean {
    return (
      this.phase === 'visible' &&
      !!this.preview &&
      !this.editor!.isComposing() &&
      $readCompletionContext()?.fingerprint === this.preview.context.fingerprint
    );
  }

  private accept(): void {
    const preview = this.preview!;
    this.cancelRequest();
    this.phase = 'idle';
    this.preview = null;
    this.editor!.update(
      () => {
        $getNodeByKey(preview.key)?.remove();
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;
        const parsed = this.markdownService!.parseMarkdownToLexical(preview.markdown);
        this.markdownService!.insertIRootNode(this.editor!, parsed, selection);
      },
      {
        tag: [PREVIEW_TAG, HISTORY_PUSH_TAG],
        onUpdate: () => {
          try {
            this.config?.onSuggestionAccepted?.({
              acceptedText: preview.markdown,
              suggestionId: preview.id,
              visibleMs: Date.now() - preview.shownAt,
            });
          } catch (error) {
            this.logger.warn('Auto-complete acceptance callback failed:', error);
          }
        },
      },
    );
  }

  destroy(): void {
    this.phase = 'destroyed';
    this.cancelRequest();
    this.cancelSettlement();
    super.destroy();
    this.removePreview();
  }
};
