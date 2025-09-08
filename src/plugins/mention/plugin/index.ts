import { DecoratorNode, LexicalEditor } from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import { IMarkdownShortCutService } from '@/plugins/markdown';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

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
    this.registerDecorator(
      kernel,
      MentionNode.getType(),
      (node: DecoratorNode<any>, editor: LexicalEditor) => {
        console.log('[MentionPlugin] Decorator called:', {
          hasConfig: !!config,
          hasDecorator: !!config?.decorator,
          nodeKey: node.getKey(),
          nodeLabel: (node as MentionNode).label,
          nodeType: node.getType(),
        });

        if (config?.decorator) {
          const result = config.decorator(node as MentionNode, editor);
          console.log('[MentionPlugin] Decorator result:', result);
          return result;
        }

        console.warn('[MentionPlugin] No decorator provided, returning null');
        return null;
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
