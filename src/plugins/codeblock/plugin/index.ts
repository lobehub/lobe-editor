import { $createCodeNode, CodeHighlightNode, CodeNode } from '@lexical/code';
import { ShikiTokenizer, registerCodeHighlighting } from '@lexical/code-shiki';
import { LexicalEditor } from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/editor-kernel/types';
import { IMarkdownShortCutService } from '@/plugins/markdown';

import { getCodeLanguageByInput } from '../utils/language';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface CodeblockPluginOptions {
  shikiTheme?: string;
  theme?: {
    code?: string;
  };
}

export const CodeblockPlugin: IEditorPluginConstructor<CodeblockPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<CodeblockPluginOptions>
{
  static pluginName = 'CodeblockPlugin';

  constructor(
    protected kernel: IEditorKernel,
    public config: CodeblockPluginOptions = {},
  ) {
    super();
    // Register the code block plugin
    kernel.registerNodes([CodeNode, CodeHighlightNode]);
    kernel.registerThemes({
      code: config.theme?.code || 'editor-code',
    });

    kernel.requireService(IMarkdownShortCutService)?.registerMarkdownShortCut({
      regExp: /^(```|···)(.+)?$/,
      replace: (parentNode, _, match) => {
        const code = $createCodeNode(getCodeLanguageByInput(match[2]));

        parentNode.replace(code);

        code.selectStart();
      },
      trigger: 'enter',
      type: 'element',
    });
  }

  onInit(editor: LexicalEditor): void {
    if (this.config?.shikiTheme) {
      const CustomShikiTokenizer = {
        $tokenize: ShikiTokenizer.$tokenize,
        defaultLanguage: ShikiTokenizer.defaultLanguage,
        defaultTheme: this.config.shikiTheme,
      };
      this.register(registerCodeHighlighting(editor, CustomShikiTokenizer));
    } else {
      this.register(registerCodeHighlighting(editor));
    }
  }
};
