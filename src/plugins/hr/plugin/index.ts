import { DecoratorNode, LexicalEditor } from 'lexical';

import { IEditorPlugin } from '@/editor-kernel';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { IEditorKernel, IEditorPluginConstructor } from '@/editor-kernel/types';
import { IMarkdownShortCutService } from '@/plugins/markdown';

import { $createHorizontalRuleNode, HorizontalRuleNode } from '../node/HorizontalRuleNode';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HRPluginOptions {
  decorator: (node: HorizontalRuleNode, editor: LexicalEditor) => any;
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
      hr: 'editor_horizontalRule',
    });
    kernel.registerDecorator(
      'horizontalrule',
      (node: DecoratorNode<any>, editor: LexicalEditor) => {
        return config?.decorator ? config.decorator(node as HorizontalRuleNode, editor) : null;
      },
    );
    kernel.requireService(IMarkdownShortCutService)?.registerMarkdownShortCut({
      regExp: /^(---|\*\*\*|___)\s?$/,
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
      type: 'element',
    });
  }
};
