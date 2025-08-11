import { DecoratorNode, LexicalEditor } from 'lexical';

import { IEditorPlugin } from '@/editor-kernel';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { IEditorKernel, IEditorPluginConstructor } from '@/editor-kernel/types';
import { IMarkdownShortCutService } from '@/plugins/markdown';

import { registerMentionCommand } from '../command';
import { $isMentionNode, MentionNode } from '../node/MentionNode';
import { registerMentionNodeSelectionObserver } from './register';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface MentionPluginOptions {
  decorator: (node: MentionNode, editor: LexicalEditor) => any;
  markdownWriter?: (file: MentionNode) => string;
  theme?: {
    mention?: string;
  };
}

export const MentionPlugin: IEditorPluginConstructor<MentionPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<MentionPluginOptions>
{
  static pluginName = 'MentionPlugin';

  constructor(
    protected kernel: IEditorKernel,
    public config?: MentionPluginOptions,
  ) {
    super();
    // Register the file node
    kernel.registerNodes([MentionNode]);
    if (config?.theme) {
      kernel.registerThemes(config?.theme);
    }
    kernel.registerDecorator(
      MentionNode.getType(),
      (node: DecoratorNode<any>, editor: LexicalEditor) => {
        return config?.decorator ? config.decorator(node as MentionNode, editor) : null;
      },
    );
    kernel
      .requireService(IMarkdownShortCutService)
      ?.registerMarkdownWriter(MentionNode.getType(), (ctx, node) => {
        if ($isMentionNode(node)) {
          if (config?.markdownWriter) {
            ctx.appendLine(config.markdownWriter(node));
            return;
          }
          ctx.appendLine(`${node.label}`);
        }
      });
  }

  onInit(editor: LexicalEditor): void {
    this.register(registerMentionCommand(editor));
    this.register(registerMentionNodeSelectionObserver(editor));
  }
};
