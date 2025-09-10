import { LexicalEditor } from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { registerCodeInlineCommand } from '../command';
import { CodeNode } from '../node/code';
import { registerCodeInline } from './registry';

export interface CodePluginOptions {
  enableHotkey?: boolean;
  theme?: string;
}

export const CodePlugin: IEditorPluginConstructor<CodePluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<CodePluginOptions>
{
  static pluginName = 'CodePlugin';

  constructor(
    private kernel: IEditorKernel,
    public config?: CodePluginOptions,
  ) {
    super();
    kernel.registerNodes([CodeNode]);
    kernel.registerThemes({
      codeInline: config?.theme || 'editor-code',
    });
  }

  onInit(editor: LexicalEditor): void {
    this.register(registerCodeInlineCommand(editor));
    this.register(
      registerCodeInline(editor, this.kernel, {
        enableHotkey: this.config?.enableHotkey,
      }),
    );

    const markdownService = this.kernel.requireService(IMarkdownShortCutService);
    if (!markdownService) {
      return;
    }

    markdownService.registerMarkdownWriter(CodeNode.getType(), (ctx, node) => {
      ctx.appendLine(`\`${node.getTextContent()}\``);
      return true;
    });
  }
};
