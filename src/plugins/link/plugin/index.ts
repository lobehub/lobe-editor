import { $createTextNode, COMMAND_PRIORITY_NORMAL, LexicalEditor, PASTE_COMMAND } from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import { IMarkdownShortCutService } from '@/plugins/markdown';
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { INSERT_LINK_COMMAND, registerLinkCommand } from '../command';
import { $createLinkNode, $isLinkNode, AutoLinkNode, LinkNode } from '../node/LinkNode';
import { registerLinkCommands } from './registry';

export interface LinkPluginOptions {
  attributes?: Record<string, string>;
  linkRegex?: RegExp;
  theme?: {
    link?: string;
  };
  validateUrl?: (url: string) => boolean;
}

export const LinkPlugin: IEditorPluginConstructor<LinkPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<LinkPluginOptions>
{
  static pluginName = 'LinkPlugin';
  protected linkRegex = /^https?:\/\/\S+$/;

  constructor(
    protected kernel: IEditorKernel,
    public config?: LinkPluginOptions,
  ) {
    super();
    // Register the link nodes
    kernel.registerNodes([LinkNode, AutoLinkNode]);
    if (config?.theme) {
      kernel.registerThemes(config.theme);
    }

    if (config?.linkRegex) {
      this.linkRegex = config.linkRegex;
    }

    kernel.requireService(IMarkdownShortCutService)?.registerMarkdownShortCut({
      regExp: /\[([^[]+)]\(([^\s()]+)(?:\s"((?:[^"]*\\")*[^"]*)"\s*)?\)\s?$/,
      replace: (textNode, match) => {
        const [, linkText, linkUrl, linkTitle] = match;
        const linkNode = $createLinkNode(linkUrl, { title: linkTitle });
        const linkTextNode = $createTextNode(linkText);
        linkTextNode.setFormat(textNode.getFormat());
        linkNode.append(linkTextNode);
        textNode.replace(linkNode);

        return linkTextNode;
      },
      trigger: ')',
      type: 'text-match',
    });

    kernel
      .requireService(IMarkdownShortCutService)
      ?.registerMarkdownWriter(LinkNode.getType(), (ctx, node) => {
        if ($isLinkNode(node)) {
          ctx.wrap('[', `](${node.getURL()})`);
        }
      });
  }

  onInit(editor: LexicalEditor): void {
    this.register(registerLinkCommand(editor));
    this.register(
      registerLinkCommands(editor, this.kernel, {
        attributes: this.config?.attributes,
        validateUrl: this.config?.validateUrl,
      }),
    );
    this.register(
      editor.registerCommand(
        PASTE_COMMAND,
        (payload: ClipboardEvent) => {
          const { clipboardData } = payload;
          if (
            clipboardData &&
            clipboardData.types &&
            clipboardData.types.length === 1 &&
            clipboardData.types[0] === 'text/plain'
          ) {
            const data = clipboardData.getData('text/plain').trim();
            if (this.linkRegex.test(data)) {
              payload.stopImmediatePropagation();
              payload.preventDefault();
              editor.dispatchCommand(INSERT_LINK_COMMAND, { url: data });
              return true;
            }
          }
          return false;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
    );
  }
};
