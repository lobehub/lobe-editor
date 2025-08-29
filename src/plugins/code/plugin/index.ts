import { LexicalEditor } from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { registerCodeInlineCommand } from '../command';
import { CodeNode } from '../node/code';
import { registerCodeInline } from './registry';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface CodePluginOptions {
  theme?: string;
}

export const CodePlugin: IEditorPluginConstructor<CodePluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<CodePluginOptions>
{
  static pluginName = 'CodePlugin';

  constructor(kernel: IEditorKernel, options?: CodePluginOptions) {
    super();
    kernel.registerNodes([CodeNode]);
    kernel.registerThemes({
      codeInline: options?.theme || 'editor-code',
    });
  }

  onInit(editor: LexicalEditor): void {
    this.register(registerCodeInlineCommand(editor));
    this.register(registerCodeInline(editor));
  }
};
