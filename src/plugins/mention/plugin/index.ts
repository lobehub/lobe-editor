import { DecoratorNode, LexicalEditor } from 'lexical';
import { Html } from 'mdast';

import { INode } from '@/editor-kernel/inode';
import { KernelPlugin } from '@/editor-kernel/plugin';
import {
  IMarkdownShortCutService,
  MARKDOWN_READER_LEVEL_HIGH,
} from '@/plugins/markdown/service/shortcut';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { registerMentionCommand } from '../command';
import { $isMentionNode, MentionNode, SerializedMentionNode } from '../node/MentionNode';
import { registerMentionNodeSelectionObserver } from './register';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface MentionPluginOptions {
  decorator: (node: MentionNode, editor: LexicalEditor) => any;
  markdownReader?: (node: Html, children: INode[]) => SerializedMentionNode | null | false;
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
        return config?.decorator ? config.decorator(node as MentionNode, editor) : null;
      },
    );
  }

  onInit(editor: LexicalEditor): void {
    this.register(registerMentionCommand(editor));
    this.register(registerMentionNodeSelectionObserver(editor));

    this.registerMarkdown();
  }

  private registerMarkdown() {
    this.kernel
      .requireService(IMarkdownShortCutService)
      ?.registerMarkdownWriter(MentionNode.getType(), (ctx, node) => {
        if ($isMentionNode(node)) {
          if (this.config?.markdownWriter) {
            ctx.appendLine(this.config.markdownWriter(node));
            return;
          }
          ctx.appendLine(`${node.label}`);
        }
      });

    if (this.config?.markdownReader) {
      this.kernel.requireService(IMarkdownShortCutService)?.registerMarkdownReader(
        'html',
        (node, children) => {
          return this.config?.markdownReader
            ? this.config.markdownReader(node, children) || false
            : false;
          // return this.config?.markdownReader ? this.config.markdownReader(node, children) || false : false;
        },
        MARKDOWN_READER_LEVEL_HIGH,
      );
    }
  }
};
