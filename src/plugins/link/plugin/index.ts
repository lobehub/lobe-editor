/* eslint-disable @typescript-eslint/no-use-before-define */
import { $createTextNode, COMMAND_PRIORITY_NORMAL, LexicalEditor, PASTE_COMMAND } from 'lexical';

import { INodeHelper } from '@/editor-kernel/inode/helper';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { ILitexmlService } from '@/plugins/litexml';
import { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { INSERT_LINK_COMMAND, registerLinkCommand } from '../command';
import { $isLinkCardNode, LinkCardNode } from '../node/LinkCardNode';
import { $isLinkIframeNode, LinkIframeNode } from '../node/LinkIframeNode';
import {
  $createLinkNode,
  $isLinkNode,
  AutoLinkNode,
  LinkAttributes,
  LinkNode,
} from '../node/LinkNode';
import { $isSchemaNode, SchemaNode } from '../node/SchemaNode';
import { normalizeSchemaLinkNode } from '../normalization';
import {
  ILinkService,
  LinkEmbedRule,
  LinkLabels,
  LinkService,
  LinkToolbarAction,
  SchemaLinkRendererConfig,
  SchemaRule,
} from '../service/i-link-service';
import { registerLinkCommands } from './registry';

export interface LinkPluginOptions {
  allowedProtocols?: string[];
  /** Registration-time option. Recreate LinkPlugin to apply changes. */
  attributes?: LinkAttributes;
  decoratorCard?: (node: LinkCardNode, editor: LexicalEditor) => any;
  decoratorIframe?: (node: LinkIframeNode, editor: LexicalEditor) => any;
  decoratorSchema?: (node: SchemaNode, editor: LexicalEditor) => any;
  /** Registration-time option. Recreate LinkPlugin to apply changes. */
  enableHotkey?: boolean;
  labels?: Partial<LinkLabels>;
  linkEmbedRules?: LinkEmbedRule[];
  /** Registration-time option. Recreate LinkPlugin to apply changes. */
  linkRegex?: RegExp;
  /** Registration-time normalization strategy. Defaults to true for legacy compatibility. */
  normalizeSchemaLinks?: boolean;
  schemaLinkRenderers?: SchemaLinkRendererConfig[];
  schemaRules?: SchemaRule[];
  /** Registration-time option. Recreate LinkPlugin to apply changes. */
  theme?: {
    link?: string;
    linkCard?: string;
    linkIframe?: string;
    schemaLink?: string;
  };
  toolbarActions?: LinkToolbarAction[];
  /** Registration-time option. Recreate LinkPlugin to apply changes. */
  validateUrl?: (url: string) => boolean;
}

export const LinkPlugin: IEditorPluginConstructor<LinkPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<LinkPluginOptions>
{
  static pluginName = 'LinkPlugin';
  protected linkRegex = /^[a-z][\d+.a-z-]*:\/\/\S+$/i;
  public service: LinkService = new LinkService();

  constructor(
    protected kernel: IEditorKernel,
    public config?: LinkPluginOptions,
  ) {
    super();
    // Register the link nodes
    kernel.registerNodes([LinkNode, AutoLinkNode, LinkCardNode, LinkIframeNode, SchemaNode]);
    this.service.updateConfig(config);
    kernel.registerService(ILinkService, this.service);
    this.registerDecorator(kernel, LinkCardNode.getType(), (node, editor) =>
      config?.decoratorCard ? config.decoratorCard(node as LinkCardNode, editor) : null,
    );
    this.registerDecorator(kernel, LinkIframeNode.getType(), (node, editor) =>
      config?.decoratorIframe ? config.decoratorIframe(node as LinkIframeNode, editor) : null,
    );
    this.registerDecorator(kernel, SchemaNode.getType(), (node, editor) =>
      config?.decoratorSchema ? config.decoratorSchema(node as SchemaNode, editor) : null,
    );
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
    if (this.config?.normalizeSchemaLinks !== false) {
      this.register(
        editor.registerNodeTransform(LinkNode, (node) => {
          normalizeSchemaLinkNode(node, editor, this.service);
        }),
      );
    }

    this.registerMarkdown();
    this.registerLiteXml();
  }

  registerLiteXml() {
    const litexmlService = this.kernel.requireService(ILitexmlService);
    if (!litexmlService) {
      return;
    }

    litexmlService.registerXMLWriter(LinkNode.getType(), (node, ctx) => {
      if ($isLinkNode(node)) {
        const attributes: Record<string, string> = { href: node.getURL() };
        return ctx.createXmlNode('a', attributes);
      }
      return false;
    });
    litexmlService.registerXMLReader('a', (xmlNode, children) => {
      const linkNode = INodeHelper.createElementNode('link', {
        children,
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'link',
        url: xmlNode.getAttribute('href') || '',
        version: 1,
      });
      return [linkNode];
    });

    litexmlService.registerXMLWriter(LinkCardNode.getType(), (node, ctx) => {
      if (!$isLinkCardNode(node)) return false;
      return ctx.createXmlNode('link-card', {
        description: node.getDescription(),
        href: node.getURL(),
        icon: node.getIcon(),
        openTarget: node.getOpenTarget() || '_blank',
        title: node.getTitle(),
      });
    });
    litexmlService.registerXMLReader('link-card', (xmlNode) => {
      return [
        INodeHelper.createTypeNode(LinkCardNode.getType(), {
          description: xmlNode.getAttribute('description') || '',
          icon: xmlNode.getAttribute('icon') || '',
          openTarget: xmlNode.getAttribute('openTarget') || '_blank',
          title: xmlNode.getAttribute('title') || xmlNode.getAttribute('href') || '',
          type: LinkCardNode.getType(),
          url: xmlNode.getAttribute('href') || '',
          version: 1,
        }),
      ];
    });

    litexmlService.registerXMLWriter(LinkIframeNode.getType(), (node, ctx) => {
      if (!$isLinkIframeNode(node)) return false;
      return ctx.createXmlNode('link-iframe', {
        href: node.getURL(),
        src: node.getSrc(),
        title: node.getTitle(),
      });
    });
    litexmlService.registerXMLReader('link-iframe', (xmlNode) => {
      return [
        INodeHelper.createTypeNode(LinkIframeNode.getType(), {
          src: xmlNode.getAttribute('src') || xmlNode.getAttribute('href') || '',
          title: xmlNode.getAttribute('title') || xmlNode.getAttribute('href') || '',
          type: LinkIframeNode.getType(),
          url: xmlNode.getAttribute('href') || '',
          version: 1,
        }),
      ];
    });

    litexmlService.registerXMLWriter(SchemaNode.getType(), (node, ctx) => {
      if (!$isSchemaNode(node)) return false;
      return ctx.createXmlNode('schema-link', {
        href: node.getURL(),
        payload: JSON.stringify(node.getPayload() ?? null),
        schemaType: node.getSchemaType(),
        title: node.getTitle(),
      });
    });
    litexmlService.registerXMLReader('schema-link', (xmlNode) => {
      return [
        INodeHelper.createTypeNode(SchemaNode.getType(), {
          payload: parseJsonAttribute(xmlNode.getAttribute('payload')),
          schemaType: xmlNode.getAttribute('schemaType') || '',
          title: xmlNode.getAttribute('title') || xmlNode.getAttribute('href') || '',
          type: SchemaNode.getType(),
          url: xmlNode.getAttribute('href') || '',
          version: 1,
        }),
      ];
    });
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
      ?.registerMarkdownWriter(LinkCardNode.getType(), (ctx, node) => {
        if ($isLinkCardNode(node)) {
          ctx.appendLine(`[${node.getTitle()}](${node.getURL()})\n`);
          return true;
        }
      });

    this.kernel
      .requireService(IMarkdownShortCutService)
      ?.registerMarkdownWriter(LinkIframeNode.getType(), (ctx, node) => {
        if ($isLinkIframeNode(node)) {
          ctx.appendLine(`[${node.getTitle()}](${node.getURL()})\n`);
          return true;
        }
      });

    this.kernel
      .requireService(IMarkdownShortCutService)
      ?.registerMarkdownWriter(SchemaNode.getType(), (ctx, node) => {
        if ($isSchemaNode(node)) {
          ctx.appendLine(`[${node.getTitle()}](${node.getURL()})\n`);
          return true;
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

function parseJsonAttribute(value: string | null): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export { normalizeSchemaLinkNode } from '../normalization';
