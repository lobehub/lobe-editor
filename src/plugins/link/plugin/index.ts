import { $createTextNode, COMMAND_PRIORITY_NORMAL, LexicalEditor, PASTE_COMMAND } from 'lexical';

import { INodeHelper } from '@/editor-kernel/inode/helper';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { INSERT_LINK_COMMAND, registerLinkCommand } from '../command';
import {
  $createLinkNode,
  $isLinkNode,
  AutoLinkNode,
  LinkAttributes,
  LinkNode,
} from '../node/LinkNode';
import { registerLinkCommands } from './registry';

export interface LinkPluginOptions {
  attributes?: LinkAttributes;
  enableHotkey?: boolean;
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
  }

  onInit(editor: LexicalEditor): void {
    this.register(registerLinkCommand(editor));
    this.register(
      registerLinkCommands(editor, this.kernel, {
        attributes: this.config?.attributes,
        enableHotkey: this.config?.enableHotkey,
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

    this.kernel.requireService(IMarkdownShortCutService)?.registerMarkdownShortCut({
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

    this.kernel
      .requireService(IMarkdownShortCutService)
      ?.registerMarkdownWriter(LinkNode.getType(), (ctx, node) => {
        if ($isLinkNode(node)) {
          ctx.wrap('[', `](${node.getURL()})`);
        }
      });

    this.kernel
      .requireService(IMarkdownShortCutService)
      ?.registerMarkdownReader('link', (node, children) => {
        const linkNode = INodeHelper.createElementNode('link', {
          children: children,
          direction: 'ltr',
          format: '',
          indent: 0,
          title: node.title || undefined,
          type: 'link',
          url: node.url || '',
          version: 1,
        });
        return [linkNode];
      });
  }
};
