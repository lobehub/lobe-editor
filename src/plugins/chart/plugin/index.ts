import type { DecoratorNode, LexicalEditor } from 'lexical';

import { INodeHelper } from '@/editor-kernel/inode/helper';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { ILitexmlService } from '@/plugins/litexml';
import {
  IMarkdownShortCutService,
  MARKDOWN_READER_LEVEL_HIGH,
} from '@/plugins/markdown/service/shortcut';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';
import { createDebugLogger } from '@/utils/debug';

import { registerChartCommand } from '../command';
import { $isChartNode, ChartNode } from '../node/ChartNode';
import { chartStateFromSource, toCdata, toMarkdownFence } from '../utils/serialize';

export const CHART_MARKDOWN_LANGUAGE = 'chart';

export interface ChartPluginOptions {
  decorator?: (node: ChartNode, editor: LexicalEditor) => unknown;
  theme?: string;
}

export const ChartPlugin: IEditorPluginConstructor<ChartPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<ChartPluginOptions>
{
  static pluginName = 'ChartPlugin';
  private logger = createDebugLogger('plugin', 'chart');

  constructor(
    protected kernel: IEditorKernel,
    public config?: ChartPluginOptions,
  ) {
    super();
    kernel.registerNodes([ChartNode]);
    kernel.registerThemes({ chart: config?.theme || '' });
    this.registerDecorator(
      kernel,
      ChartNode.getType(),
      (node: DecoratorNode<unknown>, editor: LexicalEditor) =>
        config?.decorator ? config.decorator(node as ChartNode, editor) : null,
    );
  }

  onInit(editor: LexicalEditor): void {
    this.register(registerChartCommand(editor));
    this.registerMarkdown();
    this.registerLiteXml();
  }

  private createChartINode(source: string) {
    const { raw, spec } = chartStateFromSource(source);
    if (!spec) this.logger.warn('Invalid chart spec kept as raw source');
    return INodeHelper.createTypeNode(ChartNode.getType(), spec ? { spec } : { raw, spec: null });
  }

  registerLiteXml() {
    const litexmlService = this.kernel.requireService(ILitexmlService);
    if (!litexmlService) return;

    litexmlService.registerXMLWriter(ChartNode.getType(), (node, ctx) => {
      if (!$isChartNode(node)) return false;
      return ctx.createXmlNode('chart', {}, toCdata(node.getSource()));
    });

    litexmlService.registerXMLReader('chart', (xmlElement: Element) =>
      this.createChartINode((xmlElement.textContent || '').trim()),
    );
  }

  registerMarkdown() {
    const markdownService = this.kernel.requireService(IMarkdownShortCutService);
    if (!markdownService) return;

    markdownService.registerMarkdownWriter(ChartNode.getType(), (ctx, node) => {
      if ($isChartNode(node)) {
        ctx.appendLine(toMarkdownFence(node.getSource(), CHART_MARKDOWN_LANGUAGE));
      }
    });

    markdownService.registerMarkdownReader(
      'code',
      (node) => {
        if (node.lang?.toLowerCase() !== CHART_MARKDOWN_LANGUAGE) return false;
        return this.createChartINode(node.value);
      },
      MARKDOWN_READER_LEVEL_HIGH,
    );
  }
};
