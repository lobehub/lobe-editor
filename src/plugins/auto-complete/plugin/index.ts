import {
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  $setSelection,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_HIGH,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
  LexicalEditor,
  TextNode,
} from 'lexical';

import { INodeHelper } from '@/editor-kernel/inode/helper';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { IMarkdownShortCutService } from '@/plugins/markdown';
import { IEditor, IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { PlaceholderBlockNode, PlaceholderNode } from '../node/placeholderNode';

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

  private lastCursorPosition: { key: string; offset: number; type: string } | null = null;
  private cursorStableTimer: number | null = null;
  private abortController: AbortController | null = null;
  private delay: number;
  private placeholderNodes: TextNode[] = [];
  private currentSuggestion: string | null = null;
  private markdownService: IMarkdownShortCutService | null = null;

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
      console.error('MarkdownShortCutService is required for AutoCompletePlugin');
      return;
    }

    this.register(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          if (editor.isComposing()) {
            return;
          }
          const selection = $getSelection();

          if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
            this.clearTimer();
            this.clearPlaceholderNodes(editor);
            return;
          }

          const currentPosition = {
            key: selection.anchor.key,
            offset: selection.anchor.offset,
            type: selection.anchor.type,
          };

          // Check if cursor position has changed
          if (this.hasPositionChanged(currentPosition)) {
            this.clearTimer();
            this.clearPlaceholderNodes(editor);

            this.abortController = new AbortController();
            // Start new timer for cursor stability check
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
        KEY_ESCAPE_COMMAND,
        (event) => {
          if (this.currentSuggestion) {
            event?.preventDefault();
            this.clearPlaceholderNodes(editor);
            this.currentSuggestion = null;
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
        // If user types anything while placeholder is visible, clear it
        if (this.placeholderNodes.length > 0) {
          this.clearPlaceholderNodes(editor);
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
    editor.read(() => {
      if (editor.isComposing()) {
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
      let selectionType = 'unknown';

      // Get text before cursor in the entire paragraph
      const textRet = this.getTextBeforeCursor(selection);
      selectionType = anchorNode.getType();

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
            if (result) {
              // Store suggestion and show placeholder
              this.currentSuggestion = result;
              this.showPlaceholderNodes(editor, result);

              console.log('Auto-complete triggered:', {
                afterText: textRet.textAfter,
                input: textRet.textBefore,
                position: currentPosition,
                result,
                selectionType,
              });
            } else {
              this.clearPlaceholderNodes(editor);
            }
          });
      }
    });
  }

  private getTextBeforeCursor(selection: any): {
    textAfter: string;
    textBefore: string;
  } {
    const ret = {
      textAfter: '',
      textBefore: '',
    };
    const anchorNode = selection.anchor.getNode();
    const anchorOffset = selection.anchor.offset;

    // Find the paragraph or root container
    let paragraphNode = anchorNode;
    while (paragraphNode && paragraphNode.isInline()) {
      const parent = paragraphNode.getParent();
      if (!parent) break;
      paragraphNode = parent;
    }

    if (!paragraphNode) {
      return ret;
    }

    console.info('Paragraph Node Type:', paragraphNode, anchorNode);

    let founded = false;

    // Collect all text before cursor in the paragraph
    const collectTextBeforeCursor = (
      node: any,
      targetNode: any,
      targetOffset: number,
    ): { text: string; textAfter: string } => {
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
    // this.clearPlaceholderNodes(editor); // Remove existing placeholder first

    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
        console.warn('No valid selection for placeholder');
        return;
      }
      if (!this.markdownService) {
        console.warn('No valid markdown service for placeholder');
        return;
      }

      const nodes = this.markdownService.parseMarkdownToLexical(suggestion);

      if (nodes.children[0]) {
        const firstChild = nodes.children[0];
        // Do something with the first child node
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

      // 创建标记节点并保存其key
      const markerNode = INodeHelper.createTextNode('\u200B'); // 使用零宽空格
      nodes.children.push({
        // @ts-expect-error not error
        children: [markerNode],
        name: '',
        type: 'PlaceholderInline',
      });

      const saveSel = selection.clone();
      this.markdownService.insertIRootNode(editor, nodes, selection);

      $setSelection(saveSel);
    });
  }

  private clearPlaceholderNodes(editor: LexicalEditor): void {
    editor.update(() => {
      editor.getEditorState()._nodeMap.forEach((node) => {
        const selection = $getSelection();
        const clonedSelection = selection ? selection.clone() : null;
        if (
          node.isAttached() &&
          ['PlaceholderBlock', 'PlaceholderInline'].includes(node.getType())
        ) {
          if (
            node.getType() === 'PlaceholderInline' &&
            node.getTextContent().includes('\u200B') &&
            node.getPreviousSibling() === null
          ) {
            while (node.getNextSibling()) {
              const next = node.getNextSibling();
              if (next) {
                $insertNodes([next]);
              }
            }
            $setSelection(clonedSelection);
            node.getParent()?.remove();
            return;
          }
          node.remove();
        }
      });
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

      editor.getEditorState()._nodeMap.forEach((node) => {
        if (
          node.isAttached() &&
          ['PlaceholderBlock', 'PlaceholderInline'].includes(node.getType())
        ) {
          node.remove();
        }
      });

      const nodes = this.markdownService.parseMarkdownToLexical(markdown);
      this.markdownService.insertIRootNode(editor, nodes, selection);

      this.clearPlaceholderNodes(editor);
      this.currentSuggestion = null;
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
    // Note: clearPlaceholderNodes needs editor instance, so it should be called before destroy
    this.placeholderNodes = []; // Clear references
    super.destroy();
  }
};
