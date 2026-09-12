import type { DecoratorNode, LexicalEditor } from 'lexical';

import { INodeHelper } from '@/editor-kernel/inode/helper';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { registerBlockRewriteAdapter } from '@/plugins/block/service/rewrite-adapter';
import { IHoleService } from '@/plugins/common/service/i-hole-service';
import { ILitexmlService } from '@/plugins/litexml/service/litexml-service';
import {
  IMarkdownShortCutService,
  MARKDOWN_READER_LEVEL_HIGH,
} from '@/plugins/markdown/service/shortcut';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { registerArtifactCommand } from '../command';
import { $isArtifactNode, ArtifactNode } from '../node/ArtifactNode';
import { artifactBlockRewriteAdapter } from '../rewrite-adapter';

export interface ArtifactPluginOptions {
  decorator?: (node: ArtifactNode, editor: LexicalEditor) => unknown;
  theme?: string;
}

export const ArtifactPlugin: IEditorPluginConstructor<ArtifactPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<ArtifactPluginOptions>
{
  static pluginName = 'ArtifactPlugin';

  constructor(
    protected kernel: IEditorKernel,
    config?: ArtifactPluginOptions,
  ) {
    super();
    kernel.registerNodes([ArtifactNode]);
    kernel.registerThemes({ artifact: config?.theme || '' });
    this.registerDecorator(
      kernel,
      ArtifactNode.getType(),
      (node: DecoratorNode<unknown>, editor: LexicalEditor) =>
        config?.decorator?.(node as ArtifactNode, editor) ?? null,
    );
    this.register(registerBlockRewriteAdapter(kernel, artifactBlockRewriteAdapter));
  }

  onInit(editor: LexicalEditor): void {
    const holeService = this.kernel.requireService(IHoleService);
    if (holeService) {
      this.register(
        holeService.registerTarget(ArtifactNode, {
          serializeTextContent: (node) => ($isArtifactNode(node) ? node.getTitle() : undefined),
        }),
      );
    }
    this.register(registerArtifactCommand(editor));
    this.registerLiteXml();
    this.registerMarkdown();
  }

  private registerLiteXml(): void {
    const service = this.kernel.requireService(ILitexmlService);
    if (!service) return;

    service.registerXMLWriter(ArtifactNode.getType(), (node, ctx) => {
      if (!$isArtifactNode(node)) return false;

      // LiteXML writers insert textContent verbatim. Escape the HTML source so
      // that a source document is represented as text instead of becoming part
      // of the surrounding LiteXML document. The parser decodes these entities
      // again, preserving the exact source on the way back into the node.
      return ctx.createXmlNode(
        'artifact',
        { title: node.getTitle() },
        escapeXmlText(node.getHtml()),
      );
    });
    service.registerXMLReader('artifact', (element: Element) =>
      INodeHelper.createTypeNode(ArtifactNode.getType(), {
        html: element.textContent || '',
        title: element.getAttribute('title') || 'Artifact',
        version: 1,
      }),
    );
  }

  private registerMarkdown(): void {
    const service = this.kernel.requireService(IMarkdownShortCutService);
    if (!service) return;

    service.registerMarkdownWriter(ArtifactNode.getType(), (ctx, node) => {
      if (!$isArtifactNode(node)) return false;
      const fence = getMarkdownFence(node.getHtml());
      const title = encodeURIComponent(node.getTitle());
      ctx.appendLine(`${fence}artifact title=${title}`);
      ctx.appendLine('\n');
      ctx.appendLine(node.getHtml());
      ctx.appendLine(`\n${fence}\n`);
      return true;
    });
    service.registerMarkdownReader(
      'code',
      (node) => {
        if (node.lang?.toLowerCase() !== 'artifact') return false;
        return INodeHelper.createTypeNode(ArtifactNode.getType(), {
          html: node.value,
          title: readMarkdownTitle(node.meta),
          version: 1,
        });
      },
      MARKDOWN_READER_LEVEL_HIGH,
    );
  }
};

const escapeXmlText = (value: string): string =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/** Use a fence longer than every backtick run in the source HTML. */
const getMarkdownFence = (value: string): string => {
  let longestRun = 0;

  for (const match of value.matchAll(/`+/g)) {
    longestRun = Math.max(longestRun, match[0].length);
  }

  return '`'.repeat(Math.max(3, longestRun + 1));
};

const readMarkdownTitle = (meta: string | null | undefined): string => {
  const match = meta?.match(/(?:^|\s)title=(?:"([^"]*)"|'([^']*)'|(\S*))/);
  const encodedTitle = match?.[1] ?? match?.[2] ?? match?.[3];

  if (encodedTitle === undefined) return 'Artifact';

  try {
    return decodeURIComponent(encodedTitle);
  } catch {
    return encodedTitle;
  }
};
