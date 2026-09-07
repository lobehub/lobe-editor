import type { LexicalEditor } from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { AISessionService } from '../service/ai-session-service';
import { IAISessionService } from '../service/i-ai-session-service';

export interface AISessionPluginOptions {
  enabled?: boolean;
}

export const AISessionPlugin: IEditorPluginConstructor<AISessionPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<AISessionPluginOptions>
{
  static pluginName = 'AISessionPlugin';

  readonly service = new AISessionService();

  constructor(
    protected kernel: IEditorKernel,
    public config: AISessionPluginOptions = {},
  ) {
    super();
    kernel.registerServiceHotReload(IAISessionService, this.service);
  }

  onInit(editor: LexicalEditor): void {
    if (this.config.enabled === false) return;
    this.service.bindEditor(editor);
    this.register(
      this.kernel.registerRootListener(() => {
        // Root attach/detach can happen without a Lexical update. Refreshing
        // here releases CSS highlights from a detached root and rebinds the
        // layout observers when the same editor is attached again.
        this.service.refresh();
      }),
    );
    this.register(
      editor.registerUpdateListener(() => {
        this.service.refresh();
      }),
    );
  }

  override destroy(): void {
    this.service.destroy();
    super.destroy();
  }
};
