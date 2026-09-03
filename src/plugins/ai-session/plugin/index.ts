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
