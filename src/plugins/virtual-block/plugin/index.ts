import { LexicalEditor } from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { registerRichKeydown } from './register';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface VirtualBlockPluginOptions {
  theme?: string;
}

export const VirtualBlockPlugin: IEditorPluginConstructor<VirtualBlockPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<VirtualBlockPluginOptions>
{
  static pluginName = 'VirtualBlockPlugin';

  constructor(
    protected kernel: IEditorKernel,
    config?: VirtualBlockPluginOptions,
  ) {
    super();
    kernel.registerThemes({
      virtualBlock: config?.theme || '',
    });
  }

  onInit(editor: LexicalEditor): void {
    this.register(registerRichKeydown(editor, this.kernel));
  }
};
