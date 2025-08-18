import { DecoratorNode, LexicalEditor } from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import { IMarkdownShortCutService } from '@/plugins/markdown';
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { registerHorizontalRuleCommand } from '../command';
import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  HorizontalRuleNode,
} from '../node/HorizontalRuleNode';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HRPluginOptions {
  decorator: (node: HorizontalRuleNode, editor: LexicalEditor) => any;
  theme?: string;
}

export const HRPlugin: IEditorPluginConstructor<HRPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<HRPluginOptions>
{
  static pluginName = 'HRPlugin';

  constructor(
    protected kernel: IEditorKernel,
    config?: HRPluginOptions,
  ) {
    super();
    // Register the horizontal rule node
    kernel.registerNodes([HorizontalRuleNode]);
    kernel.registerThemes({
      hr: config?.theme || '',
    });
    kernel.registerDecorator(
      'horizontalrule',
      (node: DecoratorNode<any>, editor: LexicalEditor) => {
        return config?.decorator ? config.decorator(node as HorizontalRuleNode, editor) : null;
      },
    );
    kernel.requireService(IMarkdownShortCutService)?.registerMarkdownShortCut({
      regExp: /^(---|\*\*\*|___)$/,
      replace: (parentNode, _1, _2, isImport) => {
        const line = $createHorizontalRuleNode();

        // TODO: Get rid of isImport flag
        if (isImport || parentNode.getNextSibling()) {
          parentNode.replace(line);
        } else {
          parentNode.insertBefore(line);
        }

        line.selectNext();
      },
      trigger: 'enter',
      type: 'element',
    });
    kernel
      .requireService(IMarkdownShortCutService)
      ?.registerMarkdownWriter(HorizontalRuleNode.getType(), (ctx, node) => {
        if ($isHorizontalRuleNode(node)) {
          ctx.appendLine('---\n\n');
        }
      });
  }

  onInit(editor: LexicalEditor): void {
    this.register(registerHorizontalRuleCommand(editor));
  }
};
