import { $getSelection, $isRangeSelection, LexicalEditor } from 'lexical';

import type { IEditorKernel, IEditorPlugin } from '@/editor-kernel';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { IEditorPluginConstructor } from '@/editor-kernel/types';

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
  static readonly pluginName = 'slash';

  private service: SlashService | null = null;
  private currentSlashTrigger: string | null = null;
  private currentSlashTriggerIndex = -1;

  constructor(
    kernel: IEditorKernel,
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
    this.config?.triggerClose();
    this.currentSlashTrigger = null;
    this.currentSlashTriggerIndex = -1;
  }

  onInit(editor: LexicalEditor): void {
    this.register(
      editor.registerUpdateListener(() => {
        editor.getEditorState().read(() => {
          if (!editor.isEditable()) {
            // 触发关闭
            this.triggerClose();
            return;
          }

          const editorWindow = editor._window || window;
          const range = editorWindow.document.createRange();
          const selection = $getSelection();
          const text = getQueryTextForSearch(editor);

          if (
            !$isRangeSelection(selection) ||
            !selection.isCollapsed() ||
            // code 里面不触发
            selection.hasFormat('code') ||
            text === null ||
            range === null ||
            (this.currentSlashTrigger === null && text.length > 1 && text.at(-2) !== ' ')
          ) {
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

          // 超过最大长度
          if (text.length - lastIndex > maxLength || !slashOptions) {
            this.triggerClose();
            return;
          }

          const triggerFn = this.service?.getSlashTriggerFn(triggerText);
          const fuse = this.service?.getSlashFuse(triggerText);
          const isRangePositioned = tryToPositionRange(0, range, editorWindow);
          const match = triggerFn?.(text.slice(this.currentSlashTriggerIndex));
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
