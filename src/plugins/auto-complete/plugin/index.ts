import {
  $getSelection,
  $isRangeSelection,
  $nodesOfType,
  $setSelection,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_HIGH,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
  LexicalEditor,
} from 'lexical';
import type { BaseSelection } from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import { IMarkdownShortCutService } from '@/plugins/markdown';
import { IEditor, IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';
import { createDebugLogger } from '@/utils/debug';

import { PlaceholderBlockNode, PlaceholderNode } from '../node/placeholderNode';

const AUTO_COMPLETE_GUARD_LIMIT = 50_000;

export interface AutoCompletePluginOptions {
  /** Delay in milliseconds before triggering auto-complete (default: 1000ms) */
  delay?: number;
  onAutoComplete?: (opt: {
    abortSignal: AbortSignal;
    afterText: string;
    editor: IEditor;
    input: string;
    selectionType: string;
  }) => Promise<string | null>;
  theme?: {
    placeholderBlock?: string;
    placeholderInline?: string;
  };
}

export const AutoCompletePlugin: IEditorPluginConstructor<AutoCompletePluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<AutoCompletePluginOptions>
{
  static pluginName = 'AutoCompletePlugin';

  private logger = createDebugLogger('plugin', 'auto-complete');
  private lastCursorPosition: { key: string; offset: number; type: string } | null = null;
  private cursorStableTimer: number | null = null;
  private abortController: AbortController | null = null;
  private delay: number;
  private currentSuggestion: string | null = null;
  private placeholderAnchorPosition: { key: string; offset: number; type: string } | null = null;
  private placeholderSelectionSnapshot: BaseSelection | null = null;
  private markdownService: IMarkdownShortCutService | null = null;
  private skipNextTextContentListener = false;

  constructor(
    protected kernel: IEditorKernel,
    public config?: AutoCompletePluginOptions,
  ) {
    super();
    this.delay = config?.delay ?? 1000;

    kernel.registerNodes([PlaceholderNode, PlaceholderBlockNode]);

    if (config?.theme) {
      kernel.registerThemes(config?.theme);
    }
  }

  onInit(editor: LexicalEditor): void {
    this.markdownService = this.kernel.requireService(IMarkdownShortCutService);

    if (!this.markdownService) {
      this.logger.error('❌ MarkdownShortCutService is required for AutoCompletePlugin');
      return;
    }

    this.register(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          if (editor.isComposing()) {
            this.clearTimer();
            if (this.currentSuggestion) {
              this.clearPlaceholderNodes(editor, { restoreSelection: false });
            }
            return;
          }
          const selection = $getSelection();

          if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
            this.clearTimer();
            if (this.currentSuggestion) {
              this.clearPlaceholderNodes(editor, { restoreSelection: false });
            }
            return;
          }

          const currentPosition = {
            key: selection.anchor.key,
            offset: selection.anchor.offset,
            type: selection.anchor.type,
          };

          // If cursor moved, clear any active placeholder and restart the stable timer
          if (this.hasPositionChanged(currentPosition)) {
            this.clearTimer();
            if (this.currentSuggestion) {
              this.clearPlaceholderNodes(editor, { restoreSelection: false });
            }

            this.abortController = new AbortController();
            this.cursorStableTimer = window.setTimeout(() => {
              this.handleCursorStable(editor, currentPosition);
            }, this.delay);
          }
        });
      }),
    );

    // Register Tab key handler to apply suggestion
    this.register(
      editor.registerCommand(
        KEY_TAB_COMMAND,
        (event) => {
          if (this.currentSuggestion) {
            event?.preventDefault();
            this.applySuggestion(editor);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    );

    this.register(
      editor.registerCommand(
        KEY_ARROW_LEFT_COMMAND,
        () => {
          if (this.currentSuggestion) {
            this.clearPlaceholderNodes(editor, { restoreSelection: false });
            return false;
          }
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    );

    this.register(
      editor.registerCommand(
        KEY_ARROW_RIGHT_COMMAND,
        () => {
          if (this.currentSuggestion) {
            this.clearPlaceholderNodes(editor, { restoreSelection: false });
            return false;
          }
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    );

    this.register(
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        (event) => {
          if (this.currentSuggestion) {
            event?.preventDefault();
            this.clearPlaceholderNodes(editor);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    );

    // Register text content listener to clear placeholder on any other input
    this.register(
      editor.registerTextContentListener(() => {
        if (this.skipNextTextContentListener) {
          this.skipNextTextContentListener = false;
          return;
        }

        if (this.currentSuggestion) {
          this.clearPlaceholderNodes(editor, { restoreSelection: false });
        }
      }),
    );
  }

  private hasPositionChanged(currentPosition: {
    key: string;
    offset: number;
    type: string;
  }): boolean {
    if (!this.lastCursorPosition) {
      return true;
    }

    return (
      this.lastCursorPosition.key !== currentPosition.key ||
      this.lastCursorPosition.offset !== currentPosition.offset ||
      this.lastCursorPosition.type !== currentPosition.type
    );
  }

  private clearTimer(): void {
    this.abortController?.abort('use cancel');
    if (this.cursorStableTimer) {
      clearTimeout(this.cursorStableTimer);
      this.cursorStableTimer = null;
    }
  }

  private handleCursorStable(
    editor: LexicalEditor,
    position: { key: string; offset: number; type: string },
  ): void {
    editor.getEditorState().read(() => {
      if (editor.isComposing()) {
        this.clearTimer();
        if (this.currentSuggestion) {
          this.clearPlaceholderNodes(editor, { restoreSelection: false });
        }
        return;
      }
      if (!this.abortController || this.abortController.signal.aborted) {
        return;
      }
      const selection = $getSelection();

      if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
        return;
      }

      // Verify cursor is still at the same position
      const currentPosition = {
        key: selection.anchor.key,
        offset: selection.anchor.offset,
        type: selection.anchor.type,
      };

      if (!this.isSamePosition(position, currentPosition)) {
        return;
      }

      // Avoid duplicate triggers for the same position
      if (this.lastCursorPosition && this.isSamePosition(position, this.lastCursorPosition)) {
        return;
      }

      this.lastCursorPosition = currentPosition;

      // Get context around cursor for auto-complete
      const anchorNode = selection.anchor.getNode();
      const textRet = this.getTextBeforeCursor(selection);
      const selectionType = anchorNode.getType();

      // Trigger auto-complete callback if provided
      if (this.config?.onAutoComplete) {
        this.config
          .onAutoComplete({
            abortSignal: this.abortController!.signal,
            afterText: textRet.textAfter,
            editor: this.kernel as any,
            input: textRet.textBefore,
            selectionType,
          })
          .then((result) => {
            let currentSelection: any = null;
            editor.getEditorState().read(() => {
              currentSelection = $getSelection();
            });

            if (editor.isComposing()) {
              this.clearPlaceholderNodes(editor, { restoreSelection: false });
              return;
            }

            if (
              !currentSelection ||
              !$isRangeSelection(currentSelection) ||
              !currentSelection.isCollapsed()
            ) {
              this.clearPlaceholderNodes(editor, { restoreSelection: false });
              return;
            }

            const newPosition = {
              key: currentSelection.anchor.key,
              offset: currentSelection.anchor.offset,
              type: currentSelection.anchor.type,
            };

            if (!this.isSamePosition(currentPosition, newPosition)) {
              this.clearPlaceholderNodes(editor, { restoreSelection: false });
              return;
            }

            if (result) {
              this.currentSuggestion = result;
              this.placeholderAnchorPosition = currentPosition;
              this.showPlaceholderNodes(editor, result);
              this.logger.debug('🔍 Auto-complete triggered:', {
                afterText: textRet.textAfter,
                input: textRet.textBefore,
                position: currentPosition,
                result,
                selectionType,
              });
            } else {
              this.clearPlaceholderNodes(editor, { restoreSelection: false });
            }
          });
      }
    });
  }

  private getTextBeforeCursor(selection: any): {
    textAfter: string;
    textBefore: string;
  } {
    const anchorNode = selection.anchor.getNode();
    const anchorOffset = selection.anchor.offset;

    // Find the paragraph or root container
    let paragraphNode = anchorNode;
    let parentTraversalCount = 0;
    while (paragraphNode && paragraphNode.isInline()) {
      parentTraversalCount++;
      if (parentTraversalCount > AUTO_COMPLETE_GUARD_LIMIT) {
        throw new Error(`getTextBeforeCursor: parent traversal > ${AUTO_COMPLETE_GUARD_LIMIT}`);
      }
      const parent = paragraphNode.getParent();
      if (!parent) break;
      paragraphNode = parent;
    }

    if (!paragraphNode) {
      return { textAfter: '', textBefore: '' };
    }

    this.logger.debug('🔍 Paragraph Node Type:', paragraphNode, anchorNode);

    let founded = false;
    let recursionDepth = 0;

    // Collect all text before cursor in the paragraph
    const collectTextBeforeCursor = (
      node: any,
      targetNode: any,
      targetOffset: number,
    ): { text: string; textAfter: string } => {
      recursionDepth++;
      if (recursionDepth > AUTO_COMPLETE_GUARD_LIMIT) {
        throw new Error(`collectTextBeforeCursor: recursion depth > ${AUTO_COMPLETE_GUARD_LIMIT}`);
      }

      if (node === targetNode) {
        founded = true;
        // We've reached the target node, get text up to the cursor position
        if (node.getTextContent) {
          const nodeText = node.getTextContent();
          return {
            text: nodeText.slice(0, targetOffset),
            textAfter: nodeText.slice(targetOffset),
          };
        }
        return { text: '', textAfter: '' };
      }

      let collectedText = '';
      let collectedTextAfter = '';

      // If this is a text node, collect all its text
      if (node.getTextContent && node.getType() === 'text') {
        if (founded) {
          collectedTextAfter += node.getTextContent();
        } else {
          collectedText += node.getTextContent();
        }
      }

      // Recursively check children
      if (node.getChildren) {
        const children = node.getChildren();
        for (const child of children) {
          const result = collectTextBeforeCursor(child, targetNode, targetOffset);
          collectedTextAfter += result.textAfter;
          collectedText += result.text;
        }
      }

      return { text: collectedText, textAfter: collectedTextAfter };
    };

    const result = collectTextBeforeCursor(paragraphNode, anchorNode, anchorOffset);
    return {
      textAfter: result.textAfter,
      textBefore: result.text,
    };
  }

  private showPlaceholderNodes(editor: LexicalEditor, suggestion: string): void {
    this.skipNextTextContentListener = true;

    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
        this.logger.warn('⚠️ No valid selection for placeholder');
        return;
      }
      if (!this.markdownService) {
        this.logger.warn('⚠️ No valid markdown service for placeholder');
        return;
      }

      // Always clear existing placeholder nodes before inserting a new suggestion
      // to avoid duplicated/stacked placeholder text.
      for (const node of $nodesOfType(PlaceholderNode)) {
        node.remove();
      }
      for (const node of $nodesOfType(PlaceholderBlockNode)) {
        node.remove();
      }

      const nodes = this.markdownService.parseMarkdownToLexical(suggestion);

      if (nodes.children[0]) {
        const firstChild = nodes.children[0];
        // @ts-expect-error not error
        const oldChildren = firstChild.children;
        // @ts-expect-error not error
        firstChild.children = [
          {
            children: oldChildren,
            type: 'PlaceholderInline',
          },
        ];
      }

      for (let i = 1; i < nodes.children.length; i++) {
        const child = nodes.children[i];
        nodes.children[i] = {
          // @ts-expect-error not error
          children: [child],
          type: 'PlaceholderBlock',
        };
      }

      const saveSel = selection.clone();
      this.placeholderSelectionSnapshot = saveSel;
      this.markdownService.insertIRootNode(editor, nodes, selection);

      $setSelection(saveSel);
    });
  }

  private clearPlaceholderNodes(
    editor: LexicalEditor,
    options?: { restoreSelection?: boolean },
  ): void {
    const shouldRestoreSelection = options?.restoreSelection ?? true;
    const restoreSelection = this.placeholderSelectionSnapshot;

    // Reset state immediately so listeners see no active suggestion
    this.currentSuggestion = null;
    this.placeholderAnchorPosition = null;
    this.placeholderSelectionSnapshot = null;
    // Cancel any pending AI timer
    this.clearTimer();

    // Check if there are actually placeholder nodes before queuing an update.
    // An empty editor.update() still fires listeners and can cause loops.
    let hasPlaceholderNodes = false;
    editor.getEditorState().read(() => {
      hasPlaceholderNodes =
        $nodesOfType(PlaceholderNode).length > 0 || $nodesOfType(PlaceholderBlockNode).length > 0;
    });

    if (!hasPlaceholderNodes && !(shouldRestoreSelection && restoreSelection)) {
      // Nothing to do — skip the update entirely to avoid triggering listeners
      this.skipNextTextContentListener = false;
      return;
    }

    // Skip the textContentListener that fires when we remove placeholder nodes
    this.skipNextTextContentListener = true;
    editor.update(() => {
      for (const node of $nodesOfType(PlaceholderNode)) {
        node.remove();
      }
      for (const node of $nodesOfType(PlaceholderBlockNode)) {
        node.remove();
      }

      if (shouldRestoreSelection && restoreSelection) {
        $setSelection(restoreSelection);
      }
    });
  }

  private applySuggestion(editor: LexicalEditor): void {
    if (!this.currentSuggestion) {
      return;
    }

    const markdown = this.currentSuggestion;

    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || !selection.isCollapsed() || !this.markdownService) {
        return;
      }

      for (const node of $nodesOfType(PlaceholderNode)) {
        node.remove();
      }
      for (const node of $nodesOfType(PlaceholderBlockNode)) {
        node.remove();
      }

      const nodes = this.markdownService.parseMarkdownToLexical(markdown);
      this.markdownService.insertIRootNode(editor, nodes, selection);

      this.clearPlaceholderNodes(editor, { restoreSelection: false });
    });
  }

  private isSamePosition(
    pos1: { key: string; offset: number; type: string },
    pos2: { key: string; offset: number; type: string },
  ): boolean {
    return pos1.key === pos2.key && pos1.offset === pos2.offset && pos1.type === pos2.type;
  }

  destroy(): void {
    this.clearTimer();
    super.destroy();
  }
};
