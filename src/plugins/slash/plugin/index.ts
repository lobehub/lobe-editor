import { $getSelection, $isRangeSelection, LexicalEditor } from 'lexical';

import type { IEditorKernel, IEditorPlugin } from '@/editor-kernel';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { IEditorPluginConstructor } from '@/editor-kernel/types';

import { ISlashService, SlashOptions, SlashService } from '../service/i-slash-service';
import { getQueryTextForSearch, tryToPositionRange } from '../utils/utils';

export interface SlashPluginOptions {
  slashOptions?: SlashOptions[];
  triggerClose: () => void;
  triggerOpen: (ctx: {
    getRect: () => DOMRect;
    items: Array<any>;
    match?: {
      leadOffset: number;
      matchingString: string;
      replaceableString: string;
    } | null;
  }) => void;
}

export const SlashPlugin: IEditorPluginConstructor<SlashPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<SlashPluginOptions>
{
  static readonly pluginName = 'slash';

  private service: SlashService | null = null;

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

  onInit(editor: LexicalEditor): void {
    this.register(
      editor.registerUpdateListener(() => {
        editor.getEditorState().read(() => {
          if (!editor.isEditable()) {
            // 触发关闭
            this.config?.triggerClose();
            return;
          }

          const editorWindow = editor._window || window;
          const range = editorWindow.document.createRange();
          const selection = $getSelection();
          const text = getQueryTextForSearch(editor);

          if (
            !$isRangeSelection(selection) ||
            !selection.isCollapsed() ||
            text === null ||
            range === null
          ) {
            // 触发关闭
            this.config?.triggerClose();
            return;
          }

          const slashOptions = this.service?.getSlashOptions(text[0]);
          const triggerFn = this.service?.getSlashTriggerFn(text[0]);
          const fuse = this.service?.getSlashFuse(text[0]);
          if (!slashOptions) {
            // 触发关闭
            this.config?.triggerClose();
            return;
          }

          const isRangePositioned = tryToPositionRange(0, range, editorWindow);
          const match = triggerFn?.(text);
          const finalItems =
            fuse && match && match.matchingString.length > 0
              ? fuse.search(match.matchingString).map((result) => result.item)
              : slashOptions.items;
          if (isRangePositioned !== null && finalItems.length > 0) {
            this.config?.triggerOpen({
              getRect: () => range.getBoundingClientRect(),
              items: finalItems,
              match,
            });
            return;
          }
          this.config?.triggerClose();
        });
      }),
    );
  }

  destroy(): void {
    super.destroy();
  }
};
