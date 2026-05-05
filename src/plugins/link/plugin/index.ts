import { $createTextNode, LexicalEditor } from 'lexical';

import { INodeHelper } from '@/editor-kernel/inode/helper';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { registerLinkCommand } from '../command';
import {
  $createLinkNode,
  $isLinkNode,
  AutoLinkNode,
  LinkAttributes,
  LinkNode,
} from '../node/LinkNode';
import { ILinkService, LinkService } from '../service/i-link-service';
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
  public service: LinkService = new LinkService();

  constructor(
    protected kernel: IEditorKernel,
    public config?: LinkPluginOptions,
  ) {
    super();
    // Register the link nodes
    kernel.registerNodes([LinkNode, AutoLinkNode]);
    kernel.registerService(ILinkService, this.service);
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

    this.registerMarkdown();
  }

  registerMarkdown() {
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
