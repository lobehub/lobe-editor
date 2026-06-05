import { $createListItemNode, $isListItemNode } from '@lexical/list';
import {
  $createParagraphNode,
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_CRITICAL,
  KEY_DOWN_COMMAND,
  LexicalEditor,
} from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { IBlockMenuService } from '../../block/service';
import {
  ISlashOption,
  ISlashService,
  SlashOptions,
  SlashService,
} from '../service/i-slash-service';
import { getQueryTextForSearch, tryToPositionRange } from '../utils/utils';

export interface ITriggerContext {
  getRect: () => DOMRect;
  items:
    | Array<ISlashOption>
    | ((
        search: {
          leadOffset: number;
          matchingString: string;
          replaceableString: string;
        } | null,
      ) => Promise<Array<ISlashOption>>);
  lastIndex: number;
  match?: {
    leadOffset: number;
    matchingString: string;
    replaceableString: string;
  } | null;
  trigger: SlashOptions['trigger'];
}

export interface SlashPluginOptions {
  slashOptions?: SlashOptions[];
  triggerClose: () => void;
  triggerOpen: (ctx: ITriggerContext) => void;
}

export const SlashPlugin: IEditorPluginConstructor<SlashPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<SlashPluginOptions>
{
  static readonly pluginName = 'SlashPlugin';

  private service: SlashService | null = null;
  private currentSlashTrigger: string | null = null;
  private currentSlashTriggerIndex = -1;
  private manualOpen = false;
  private suppressOpen = false;

  constructor(
    protected kernel: IEditorKernel,
    public config?: SlashPluginOptions,
  ) {
    super();
    this.service = new SlashService(kernel);
    kernel.registerService(ISlashService, this.service);
    if (config?.slashOptions) {
      config.slashOptions.forEach((option) => {
        this.service?.registerSlash(option);
      });
    }
  }

  private triggerClose() {
    const shouldNotifyClose =
      this.currentSlashTrigger !== null || this.manualOpen || !this.suppressOpen;

    if (shouldNotifyClose) {
      this.config?.triggerClose?.();
    }
    this.currentSlashTrigger = null;
    this.currentSlashTriggerIndex = -1;
    this.manualOpen = false;
    // After an explicit close, suppress reopening until next typing input
    this.suppressOpen = true;
  }

  onInit(editor: LexicalEditor): void {
    const blockMenuService = this.kernel.requireService(IBlockMenuService);

    if (blockMenuService) {
      const unregisterAddBlockButton = blockMenuService.registerActionButton({
        icon: 'plus',
        key: '__slash_add_below',
        onClick: (context) => {
          const lexicalEditor = context.editor.getLexicalEditor();
          if (!lexicalEditor) return;

          const slashOptions = this.service?.getSlashOptions('/') || this.config?.slashOptions?.[0];
          if (!slashOptions) return;
          let nextParagraphBlockId: string | null = null;

          lexicalEditor.focus();
          lexicalEditor.update(() => {
            const targetNode = $getNodeByKey(context.blockId);
            if (!targetNode) return;

            let nextNode;
            if ($isListItemNode(targetNode)) {
              // If it's a list item, create another list item
              nextNode = $createListItemNode();
              targetNode.insertAfter(nextNode);
            } else {
              // Otherwise create a paragraph
              nextNode = $createParagraphNode();
              targetNode.insertAfter(nextNode);
            }

            nextNode.selectStart();
            nextParagraphBlockId = nextNode.getKey();
          });

          const fallbackRect = context.blockElement.getBoundingClientRect();
          this.manualOpen = true;
          this.currentSlashTrigger = slashOptions.trigger;
          this.currentSlashTriggerIndex = -1;
          this.config?.triggerOpen({
            getRect: () => {
              if (nextParagraphBlockId) {
                const root = lexicalEditor.getRootElement();
                const paragraphElement = root?.querySelector<HTMLElement>(
                  `[data-block-id="${nextParagraphBlockId}"]`,
                );

                if (paragraphElement) {
                  return paragraphElement.getBoundingClientRect();
                }
              }

              return fallbackRect;
            },
            items: slashOptions.items,
            lastIndex: -1,
            match: null,
            trigger: slashOptions.trigger,
          });
        },
        order: -100,
        title: 'Add block below',
      });

      this.register(unregisterAddBlockButton);
    }

    // Reset suppression on typing-related key presses
    this.register(
      editor.registerCommand<KeyboardEvent>(
        KEY_DOWN_COMMAND,
        (event) => {
          if (event.isComposing) return false;
          const key = event.key;
          // Any character input or deletion should re-enable opening
          if (key.length === 1 || key === 'Backspace' || key === 'Delete') {
            this.suppressOpen = false;
            this.manualOpen = false;
          }
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    );

    this.register(
      editor.registerUpdateListener(() => {
        editor.getEditorState().read(() => {
          if (!editor.isEditable()) {
            // Trigger close
            this.triggerClose();
            return;
          }

          if (this.manualOpen) {
            return;
          }

          const isComposing = editor.isComposing();
          if (isComposing) {
            // Currently typing, do not handle
            return;
          }
          const editorWindow = editor._window || window;
          // Skip on server side
          if (editorWindow === undefined || !editorWindow.document) {
            return;
          }
          const range = editorWindow.document.createRange();
          const selection = $getSelection();
          const text = getQueryTextForSearch(editor);

          if (
            !$isRangeSelection(selection) ||
            !selection.isCollapsed() ||
            // Do not trigger inside code
            selection.hasFormat('code') ||
            text === null ||
            range === null ||
            (this.currentSlashTrigger === null && text.length > 1 && text.at(-2) !== ' ')
          ) {
            this.triggerClose();
            return;
          }

          // If we previously suppressed opening, do not reopen until user types
          if (this.currentSlashTrigger === null && this.suppressOpen) {
            this.triggerClose();
            return;
          }

          let triggerText = this.currentSlashTrigger;
          if (triggerText === null) {
            triggerText = text.slice(-1);
            this.currentSlashTriggerIndex = text.length - 1;
          }
          const lastIndex = text.lastIndexOf(triggerText);
          if (lastIndex < this.currentSlashTriggerIndex) {
            this.triggerClose();
            return;
          }
          const slashOptions = this.service?.getSlashOptions(triggerText);
          const maxLength = slashOptions?.maxLength || 75;

          // Exceeds maximum length
          if (text.length - lastIndex > maxLength || !slashOptions) {
            this.triggerClose();
            return;
          }

          const triggerFn = this.service?.getSlashTriggerFn(triggerText);
          const fuse = this.service?.getSlashFuse(triggerText);
          const isRangePositioned = tryToPositionRange(
            this.currentSlashTriggerIndex,
            range,
            editorWindow,
          );
          const match = triggerFn?.(text.slice(this.currentSlashTriggerIndex));

          // Check if there's a space in the current search text that should close the menu
          const searchText = text.slice(this.currentSlashTriggerIndex);
          const hasSpaceAfterTrigger = searchText.includes(' ') && !slashOptions?.allowWhitespace;

          if (hasSpaceAfterTrigger) {
            this.triggerClose();
            return;
          }

          const finalItems =
            fuse && match && match.matchingString.length > 0
              ? fuse.search(match.matchingString).map((result) => result.item)
              : slashOptions.items;
          if (isRangePositioned !== null && finalItems.length > 0) {
            this.currentSlashTrigger = triggerText;
            this.config?.triggerOpen({
              getRect: () => range.getBoundingClientRect(),
              items: finalItems,
              lastIndex,
              match,
              trigger: slashOptions.trigger,
            });
            return;
          }
          this.triggerClose();
        });
      }),
    );
  }

  destroy(): void {
    super.destroy();
  }
};
