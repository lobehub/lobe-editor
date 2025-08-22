import { DecoratorNode, LexicalEditor } from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import { IMarkdownShortCutService } from '@/plugins/markdown';
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { registerMathCommand } from '../command';
import { $createMathInlineNode, MathBlockNode, MathInlineNode } from '../node';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface MathPluginOptions {
  decorator: (node: MathInlineNode, editor: LexicalEditor) => unknown;
  theme?: {
    mathBlock?: string;
    mathInline?: string;
  };
}

export const MathPlugin: IEditorPluginConstructor<MathPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<MathPluginOptions>
{
  public static readonly pluginName = 'MathPlugin';

  constructor(
    protected kernel: IEditorKernel,
    public config?: MathPluginOptions,
  ) {
    super();
    kernel.registerNodes([MathInlineNode, MathBlockNode]);
    if (config?.theme) {
      kernel.registerThemes(config?.theme);
    }
    kernel.registerDecorator(
      MathInlineNode.getType(),
      (node: DecoratorNode<unknown>, editor: LexicalEditor) => {
        return config?.decorator ? config.decorator(node as MathInlineNode, editor) : null;
      },
    );
    kernel.registerDecorator(
      MathBlockNode.getType(),
      (node: DecoratorNode<unknown>, editor: LexicalEditor) => {
        return config?.decorator ? config.decorator(node as MathBlockNode, editor) : null;
      },
    );

    kernel.requireService(IMarkdownShortCutService)?.registerMarkdownShortCut({
      regExp: /\$([^$]+)\$\s?$/,
      replace: (textNode, match) => {
        const [, code] = match;
        const mathNode = $createMathInlineNode(code);
        console.log(mathNode);
        // textNode.replace(mathNode);
        textNode.insertBefore(mathNode);
        textNode.setTextContent('');
        textNode.select();
        // mathNode.selectEnd();

        return;
      },
      trigger: '$',
      type: 'text-match',
    });
  }

  onInit(editor: LexicalEditor): void {
    this.register(registerMathCommand(editor));
  }
};
