import { $isTableNode } from '@lexical/table';
import type { ElementNode, LexicalEditor, LexicalNode } from 'lexical';
import { $nodesOfType, HISTORIC_TAG } from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import { IMarkdownShortCutService } from '@/plugins/markdown';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor, IServiceID } from '@/types';

import { registerLiteXMLCommand } from '../command';
import { registerLiteXMLDiffCommand } from '../command/diffCommand';
import LitexmlDataSource from '../data-source/litexml-data-source';
import { $isDiffContentNode, DiffContentNode } from '../node/DiffContentNode';
import { DiffNode } from '../node/DiffNode';
import { $isTableCellDiffNode, TableCellDiffNode } from '../node/TableCellDiffNode';
import { $isTableRowDiffNode, TableRowDiffNode } from '../node/TableRowDiffNode';
import { ILitexmlService, LitexmlService } from '../service/litexml-service';
import { registerLegacyTableCellDiffNormalization } from '../table-cell-diff';
import { registerTableRowDiffNormalization } from '../table-row-diff';

/**
 * LitexmlPluginOptions - Configuration options for the Litexml plugin
 */
export interface LitexmlPluginOptions {
  decorator: (node: DiffNode, editor: LexicalEditor) => any;
  /**
   * Enable or disable the litexml data source
   * @default true
   */
  enabled?: boolean;
  tableRowDiffTheme?: string;
  tableCellDiffTheme?: string;
  theme?: string;
}

/**
 * LitexmlPlugin - A plugin that provides XML-based data source support
 * Allows converting between Lexical editor state and XML format
 */
export const LitexmlPlugin: IEditorPluginConstructor<LitexmlPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<LitexmlPluginOptions>
{
  static pluginName = 'LitexmlPlugin';
  datasource: LitexmlDataSource;
  service: ILitexmlService;

  constructor(
    protected kernel: IEditorKernel,
    public config?: LitexmlPluginOptions,
  ) {
    super();

    kernel.registerThemes({
      diffNode: config?.theme || 'editor_diffNode',
      tableRowDiff: config?.tableRowDiffTheme || 'editor_tableRowDiff',
      tableCellDiff: config?.tableCellDiffTheme || 'editor_tableCellDiff',
    });

    // Create and register the Litexml service
    const litexmlService = new LitexmlService();
    this.service = litexmlService;
    kernel.registerService(ILitexmlService, litexmlService);
    this.datasource = new LitexmlDataSource(
      'litexml',
      <T>(serviceId: IServiceID<T>) => {
        return kernel.requireService(serviceId);
      },
      litexmlService,
    );

    // register diff node type
    kernel.registerNodes([DiffNode, DiffContentNode, TableRowDiffNode, TableCellDiffNode]);
    kernel.registerDecorator(DiffNode.getType(), {
      queryDOM: (el: HTMLElement) => el.querySelector('.toolbar')!,
      render: (node: LexicalNode, editor: LexicalEditor) => {
        return config?.decorator ? config.decorator(node as DiffNode, editor) : null;
      },
    });

    // Register the litexml data source
    if (config?.enabled !== false) {
      kernel.registerDataSource(this.datasource);
    }
  }

  onInit(editor: LexicalEditor): void {
    // Plugin initialization logic can be added here if needed
    this.register(registerLiteXMLCommand(editor, this.datasource));
    this.register(registerLiteXMLDiffCommand(editor));
    this.register(registerLegacyTableCellDiffNormalization(editor));
    this.register(registerTableRowDiffNormalization(editor));

    this.register(
      editor.registerNodeTransform(DiffNode, (node) => {
        if (node.diffType === 'modify' && node.getChildrenSize() === 1) {
          node.setDiffType('remove');
        }
      }),
    );

    // 补充逻辑：初始化加载/重置 State 时，NodeTransform 不会触发。需要用 UpdateListener 扫一遍存量节点。
    this.register(
      editor.registerUpdateListener(({ editorState, prevEditorState, tags }) => {
        if (editorState === prevEditorState) return;
        if (tags.has(HISTORIC_TAG)) return;

        let shouldNormalize = false;
        editorState.read(() => {
          shouldNormalize = $nodesOfType(DiffNode).some(
            (node) => node.diffType === 'modify' && node.getChildrenSize() === 1,
          );
        });

        if (!shouldNormalize) return;

        editor.update(() => {
          const diffNodes = $nodesOfType(DiffNode);
          for (const node of diffNodes) {
            if (node.diffType === 'modify' && node.getChildrenSize() === 1) {
              node.setDiffType('remove');
            }
          }
        });
      }),
    );

    this.registerLiteXml();
    this.registerMarkdown();
  }

  private registerLiteXml() {
    this.service.registerXMLWriter(DiffNode.getType(), (node, ctx, indent, nodeToXML) => {
      const diffNode = node as DiffNode;
      const lines: string[] = [];
      switch (diffNode.diffType) {
        case 'modify': {
          const after = diffNode.getChildAtIndex(1);
          if ($isDiffContentNode(after)) {
            after.getChildren().forEach((child) => nodeToXML(child, lines, indent));
          } else {
            nodeToXML(after, lines, indent);
          }
          break;
        }
        case 'add': {
          diffNode.getChildren().forEach((child) => nodeToXML(child, lines, indent));
          break;
        }
        case 'remove': {
          break;
        }
        case 'listItemModify': {
          (diffNode.getChildAtIndex(1) as ElementNode).getChildren().forEach((child) => {
            nodeToXML(child, lines, indent);
          });
          break;
        }
        default: {
          break;
        }
      }
      return {
        lines,
      };
    });

    this.service.registerXMLWriter(TableRowDiffNode.getType(), (node, ctx) => {
      if (!$isTableRowDiffNode(node)) return false;
      if (node.getDiffType() === 'remove') return { lines: [] };
      return ctx.createXmlNode('tr', {});
    });

    this.service.registerXMLWriter(TableCellDiffNode.getType(), (node, ctx) => {
      if (!$isTableCellDiffNode(node)) return false;
      if (node.getDiffType() === 'remove') return { lines: [] };
      const attributes: Record<string, string> = {};
      if (node.getColSpan() > 1) attributes.colSpan = String(node.getColSpan());
      if (node.getRowSpan() > 1) attributes.rowSpan = String(node.getRowSpan());
      if (node.getBackgroundColor()) attributes.backgroundColor = node.getBackgroundColor()!;
      return ctx.createXmlNode('td', attributes);
    });
  }

  private registerMarkdown() {
    const markdownService = this.kernel.requireService(IMarkdownShortCutService);
    markdownService?.registerMarkdownWriter(TableCellDiffNode.getType(), (ctx, node) => {
      if (!$isTableCellDiffNode(node)) return false;
      if (node.getDiffType() === 'remove') return true;
      if (!node.getNextSibling()) ctx.wrap('|', '|');
      else ctx.wrap('|', '');
      return true;
    });
    markdownService?.registerMarkdownWriter(TableRowDiffNode.getType(), (ctx, node) => {
      if (!$isTableRowDiffNode(node)) return false;
      if (node.getDiffType() === 'remove') return true;

      const parent = node.getParent();
      if (!$isTableNode(parent)) return true;
      const hasPreviousProjectedRow = node
        .getPreviousSiblings()
        .some((sibling) => !$isTableRowDiffNode(sibling) || sibling.getDiffType() !== 'remove');
      if (hasPreviousProjectedRow) {
        ctx.wrap('', '\n');
      } else {
        ctx.wrap(
          '',
          `\n${parent
            .getColWidths()
            ?.map(() => '|:--')
            .join('')}|\n`,
        );
      }
    });
    markdownService?.registerMarkdownWriter(DiffNode.getType(), (ctx, node) => {
      const diffNode = node as DiffNode;
      switch (diffNode.diffType) {
        case 'modify': {
          const after = diffNode.getChildAtIndex(1);
          if ($isDiffContentNode(after)) {
            after.getChildren().forEach((child) => ctx.processChild(ctx, child));
          } else {
            ctx.processChild(ctx, after as LexicalNode);
          }
          break;
        }
        case 'add': {
          diffNode.getChildren().forEach((child) => ctx.processChild(ctx, child));
          break;
        }
        case 'remove': {
          break;
        }
        case 'listItemModify': {
          (diffNode.getChildAtIndex(1) as ElementNode).getChildren().forEach((child) => {
            ctx.processChild(ctx, child);
          });
          break;
        }
        default: {
          break;
        }
      }
      return true;
    });
  }
};
