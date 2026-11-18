import type { LexicalEditor } from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import { hasHeadingChange } from '@/plugins/common/utils/heading-change';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import type { TocPluginOptions } from '../service';
import { ITocService, TocService } from '../service';

export const TocPlugin: IEditorPluginConstructor<TocPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<TocPluginOptions>
{
  static pluginName = 'TocPlugin';

  public service: TocService;

  constructor(
    protected kernel: IEditorKernel,
    public config: TocPluginOptions = {},
  ) {
    super();

    this.service = new TocService();
    this.service.setDepthRange(config);
    kernel.registerServiceHotReload(ITocService, this.service);
  }

  onInit(editor: LexicalEditor): void {
    this.service.bindEditor(editor);
    this.service.refresh();

    const refreshOnDocumentChange = this.service.refresh.bind(this.service);

    this.kernel.on('documentChange', refreshOnDocumentChange);
    this.register(() => this.kernel.off('documentChange', refreshOnDocumentChange));
    this.register(
      editor.registerUpdateListener(
        ({ dirtyElements, dirtyLeaves, editorState, prevEditorState }) => {
          if (!hasHeadingChange(editorState, prevEditorState, dirtyElements, dirtyLeaves)) {
            return;
          }

          this.service.refresh();
        },
      ),
    );
  }
};
