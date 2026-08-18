import type { LexicalEditor } from 'lexical';

import { INodeHelper } from '@/editor-kernel/inode/helper';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { $isCollapsibleNode, CollapsibleNode } from '@/plugins/collapsible/node/CollapsibleNode';
import { ILitexmlService } from '@/plugins/litexml';
import { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

/**
 * Serialization-only collapsible support for the Node headless runtime.
 *
 * The interactive CollapsiblePlugin installs DOM listeners and imports Yjs;
 * neither belongs in the server bundle. Keeping this adapter small also makes
 * the supported headless node set explicit.
 */
export type HeadlessCollapsiblePluginOptions = Record<string, never>;

export const HeadlessCollapsiblePlugin: IEditorPluginConstructor<HeadlessCollapsiblePluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<HeadlessCollapsiblePluginOptions>
{
  static pluginName = 'HeadlessCollapsiblePlugin';

  constructor(protected kernel: IEditorKernel) {
    super();
    kernel.registerNodes([CollapsibleNode]);
  }

  onInit(_editor: LexicalEditor): void {
    const markdownService = this.kernel.requireService(IMarkdownShortCutService);
    markdownService?.registerMarkdownWriter(CollapsibleNode.getType(), (ctx, node) => {
      if (!$isCollapsibleNode(node)) return false;

      ctx.appendLine(`<details${node.isCollapsed() ? '' : ' open'}>\n`);
      ctx.appendLine(`<summary>${escapeHtml(node.getTitle())}</summary>\n\n`);
      node
        .getChildren()
        .slice(1)
        .forEach((child) => ctx.processChild(ctx, child));
      ctx.appendLine('\n</details>\n');
      return true;
    });
    markdownService?.registerMarkdownReader('html', (node, children) => {
      const tag = getHtmlTagName(node.value);
      if (tag === 'summary') {
        return INodeHelper.createTypeNode('__collapsible_summary', {
          text: getNodeText(children),
        });
      }
      if (tag !== 'details') return false;

      const summaryNode = children.find((child) => child.type === '__collapsible_summary');
      const contentChildren = children.filter((child) => child.type !== '__collapsible_summary');
      const title =
        summaryNode && 'text' in summaryNode && typeof summaryNode.text === 'string'
          ? summaryNode.text
          : extractSummaryTitle(node.value) || 'Details';

      return INodeHelper.createElementNode(CollapsibleNode.getType(), {
        children: ensureTitleChildren(contentChildren, title),
        collapsed: !/\sopen(?:\s|>|$)/i.test(node.value),
        title,
      });
    });

    const litexmlService = this.kernel.requireService(ILitexmlService);
    litexmlService?.registerXMLWriter(CollapsibleNode.getType(), (node, ctx) => {
      if (!$isCollapsibleNode(node)) return false;
      return ctx.createXmlNode('collapsible', {
        collapsed: String(node.isCollapsed()),
        title: node.getTitle(),
      });
    });
    litexmlService?.registerXMLReader('collapsible', (xmlNode, children) => {
      const title = xmlNode.getAttribute('title') || 'Details';
      return INodeHelper.createElementNode(CollapsibleNode.getType(), {
        children: ensureTitleChildren(children, title),
        collapsed: xmlNode.getAttribute('collapsed') === 'true',
        title,
      });
    });
  }
};

const getHtmlTagName = (value: string): string =>
  value.match(/^<\/?\s*([\da-z-]+)/i)?.[1]?.toLowerCase() || '';

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const extractSummaryTitle = (value: string): string =>
  value.match(/<summary\b[^>]*>([\S\s]*?)<\/summary>/i)?.[1]?.trim() || '';

const getNodeText = (children: unknown[]): string =>
  children
    .map((child) => {
      if (!child || typeof child !== 'object') return '';
      if ('text' in child && typeof child.text === 'string') return child.text;
      if ('children' in child && Array.isArray(child.children)) return getNodeText(child.children);
      return '';
    })
    .join('');

const ensureTitleChildren = (children: any[], title: string): any[] => {
  const trimmedTitle = title.trim();
  if (!trimmedTitle || getNodeText(children.slice(0, 1)).trim() === trimmedTitle) return children;

  return [
    INodeHelper.createParagraph({ children: [INodeHelper.createTextNode(title)] }),
    ...children,
  ];
};
