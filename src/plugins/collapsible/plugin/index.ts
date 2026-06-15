import { LexicalEditor } from 'lexical';

import { INodeHelper } from '@/editor-kernel/inode/helper';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { ILitexmlService } from '@/plugins/litexml';
import { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { registerCollapsibleCommand } from '../command';
import { $isCollapsibleNode, CollapsibleNode } from '../node/CollapsibleNode';

export interface CollapsiblePluginOptions {
  theme?: {
    collapsible?: string;
  };
}

export const CollapsiblePlugin: IEditorPluginConstructor<CollapsiblePluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<CollapsiblePluginOptions>
{
  static pluginName = 'CollapsiblePlugin';

  constructor(
    protected kernel: IEditorKernel,
    public config?: CollapsiblePluginOptions,
  ) {
    super();
    kernel.registerNodes([CollapsibleNode]);
    if (config?.theme) {
      kernel.registerThemes(config.theme);
    }
  }

  onInit(editor: LexicalEditor): void {
    this.register(registerCollapsibleCommand(editor));
    this.registerMarkdown();
    this.registerLiteXml();
  }

  private registerLiteXml() {
    const litexmlService = this.kernel.requireService(ILitexmlService);
    if (!litexmlService) return;

    litexmlService.registerXMLWriter(CollapsibleNode.getType(), (node, ctx) => {
      if (!$isCollapsibleNode(node)) return false;

      return ctx.createXmlNode('collapsible', {
        collapsed: String(node.isCollapsed()),
        title: node.getTitle(),
      });
    });

    litexmlService.registerXMLReader('collapsible', (xmlNode, children) => {
      return INodeHelper.createElementNode(CollapsibleNode.getType(), {
        children,
        collapsed: xmlNode.getAttribute('collapsed') === 'true',
        title: xmlNode.getAttribute('title') || 'Details',
      });
    });
  }

  private registerMarkdown() {
    const markdownService = this.kernel.requireService(IMarkdownShortCutService);
    if (!markdownService) return;

    markdownService.registerMarkdownWriter(CollapsibleNode.getType(), (ctx, node) => {
      if (!$isCollapsibleNode(node)) return false;

      ctx.appendLine(`<details${node.isCollapsed() ? '' : ' open'}>\n`);
      ctx.appendLine(`<summary>${escapeHtml(node.getTitle())}</summary>\n\n`);
      node.getChildren().forEach((child) => ctx.processChild(ctx, child));
      ctx.appendLine('\n</details>\n');
      return true;
    });

    markdownService.registerMarkdownReader('html', (node, children) => {
      const tag = getHtmlTagName(node.value);
      if (tag === 'summary') {
        return INodeHelper.createTypeNode('__collapsible_summary', {
          text: getNodeText(children),
        });
      }

      if (tag !== 'details') return false;

      const summaryNode = children.find((child) => child.type === '__collapsible_summary');
      const contentChildren = children.filter((child) => child.type !== '__collapsible_summary');

      return INodeHelper.createElementNode(CollapsibleNode.getType(), {
        children: contentChildren,
        collapsed: !/\sopen(?:\s|>|$)/i.test(node.value),
        title:
          summaryNode && 'text' in summaryNode && typeof summaryNode.text === 'string'
            ? summaryNode.text
            : extractSummaryTitle(node.value) || 'Details',
      });
    });
  }
};

function getHtmlTagName(value: string): string {
  const match = value.match(/^<\/?\s*([a-z0-9-]+)/i);
  return match?.[1]?.toLowerCase() || '';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function extractSummaryTitle(value: string): string {
  const match = value.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i);
  return match?.[1]?.trim() || '';
}

function getNodeText(children: unknown[]): string {
  return children
    .map((child) => {
      if (!child || typeof child !== 'object') return '';
      if ('text' in child && typeof child.text === 'string') return child.text;
      if ('children' in child && Array.isArray(child.children)) {
        return getNodeText(child.children);
      }
      return '';
    })
    .join('');
}
