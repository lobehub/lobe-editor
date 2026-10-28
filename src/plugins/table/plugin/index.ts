import {
  $computeTableMapSkipCellCheck,
  $createTableSelection,
  $isTableNode,
  registerTableCellUnmergeTransform,
  registerTablePlugin,
  registerTableSelectionObserver,
  setScrollableTablesActive,
  TableCellNode,
  TableRowNode,
} from '@lexical/table';
import type { LexicalEditor } from 'lexical';
import { $setSelection } from 'lexical';
import type { ReactNode } from 'react';

import { INodeHelper } from '@/editor-kernel/inode/helper';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { IBlockMenuService } from '@/plugins/block/service';
import { ILitexmlService } from '@/plugins/litexml';
import { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';
import type { IDecorator, IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';
import { cx } from '@/utils/cx';

import { registerTableAlignCommand, registerTableCommand } from '../command';
import { patchTableNode, TableNode } from '../node';
import { $getTableMarkdownDelimiterRow } from '../node/column-align';
import { ITableControllerMenuService, TableControllerMenuService } from '../service';
import {
  $writeColumnAlignsAttribute,
  readColumnAlignsAttribute,
  readMarkdownColumnAligns,
  registerTableColumnAlignDOM,
} from './column-align';
import { registerTableControllerMenu } from './controller-menu';
import { isRemovedTableRowDiff, tableCellProcessor } from './helpers';
import { registerSingleCellTablePaste } from './single-cell-paste';

export interface TablePluginOptions {
  decorator?: (node: TableNode, editor: LexicalEditor) => ReactNode;
  theme?: string;
}

function isHeadlessEditor(editor: LexicalEditor): boolean {
  return editor._headless === true;
}

export const TablePlugin: IEditorPluginConstructor<TablePluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<TablePluginOptions>
{
  static pluginName = 'TablePlugin';

  constructor(
    protected kernel: IEditorKernel,
    options?: TablePluginOptions,
  ) {
    super();
    patchTableNode();
    kernel.registerServiceHotReload(ITableControllerMenuService, new TableControllerMenuService());
    // Register the horizontal rule node
    kernel.registerNodes([TableNode, TableRowNode, TableCellNode]);

    if (options?.decorator) {
      kernel.registerDecorator(TableNode.getType(), {
        multi: [
          {
            queryDOM: (el: HTMLElement) => el.querySelector('.toolbar-col') as HTMLElement,
            render: (node: TableNode, editor: LexicalEditor) =>
              options.decorator?.(node, editor) || null,
          },
        ],
      } as unknown as IDecorator);
      this.registeredDecorators.add(TableNode.getType());
    }
    kernel.registerThemes({
      table: 'editor_table',
      tableCell: 'editor_table_cell',
      tableCellHeader: 'editor_table_cell_header',
      tableCellSelected: 'editor_table_cell_selected',
      tableScrollableWrapper: cx('editor_table_scrollable_wrapper', options?.theme),
    });
  }

  onInit(editor: LexicalEditor): void {
    this.register(registerTableCellUnmergeTransform(editor));
    this.register(registerSingleCellTablePaste(editor));
    this.register(registerTableAlignCommand(editor));

    if (!isHeadlessEditor(editor)) {
      setScrollableTablesActive(editor, true);
      this.register(registerTablePlugin(editor));
      this.register(registerTableSelectionObserver(editor));
      this.register(registerTableCommand(editor));
      this.register(registerTableColumnAlignDOM(editor));
    }

    this.registerMarkdown();
    this.registerLiteXml();
    this.registerControllerMenu();
    this.registerBlockSelect();
  }

  registerBlockSelect() {
    const blockMenuService = this.kernel.requireService(IBlockMenuService);
    if (!blockMenuService) {
      return;
    }

    this.register(
      blockMenuService.registerSelectHandler({
        key: '__table_block_select_handler',
        onSelect: (node) => {
          if (!$isTableNode(node)) {
            return false;
          }

          const [tableMap] = $computeTableMapSkipCellCheck(node, null, null);
          const firstCell = tableMap[0]?.[0]?.cell;
          const lastRow = [...tableMap].reverse().find((row) => row.length > 0);
          const lastCell = lastRow?.at(-1)?.cell;

          if (!firstCell || !lastCell) {
            return false;
          }

          const tableSelection = $createTableSelection();
          tableSelection.set(node.getKey(), firstCell.getKey(), lastCell.getKey());
          $setSelection(tableSelection);
          return true;
        },
        order: 100,
      }),
    );
  }

  registerControllerMenu() {
    const tableControllerMenuService = this.kernel.requireService(ITableControllerMenuService);
    if (!tableControllerMenuService) {
      return;
    }

    for (const unregister of registerTableControllerMenu(tableControllerMenuService, this.kernel)) {
      this.register(unregister);
    }
  }

  registerLiteXml() {
    const litexmlService = this.kernel.requireService(ILitexmlService);
    if (!litexmlService) {
      return;
    }

    litexmlService.registerXMLWriter(TableNode.getType(), (node, ctx) => {
      if ($isTableNode(node)) {
        const attributes: { [key: string]: string } = {};
        const colWidths = node.getColWidths();
        if (colWidths && colWidths.length > 0) {
          attributes.colWidths = colWidths.join(',');
        }
        $writeColumnAlignsAttribute(node, attributes);
        return ctx.createXmlNode('table', attributes);
      }
      return false;
    });

    litexmlService.registerXMLWriter(TableRowNode.getType(), (node, ctx) => {
      if (node instanceof TableRowNode) {
        return ctx.createXmlNode('tr', {});
      }
      return false;
    });

    litexmlService.registerXMLWriter(TableCellNode.getType(), (node, ctx) => {
      if (node instanceof TableCellNode) {
        const attributes: { [key: string]: string } = {};
        if (node.getColSpan() > 1) {
          attributes.colSpan = node.getColSpan().toString();
        }
        if (node.getRowSpan() > 1) {
          attributes.rowSpan = node.getRowSpan().toString();
        }
        if (node.getBackgroundColor()) {
          attributes.backgroundColor = node.getBackgroundColor()!;
        }
        return ctx.createXmlNode('td', attributes);
      }
      return false;
    });

    litexmlService.registerXMLReader('table', (xmlNode, children) => {
      const colWidthsAttr = xmlNode.getAttribute('colWidths');
      const colWidths = colWidthsAttr
        ? colWidthsAttr.split(',').map((width: string) => parseInt(width, 10))
        : [];
      return INodeHelper.createElementNode(TableNode.getType(), {
        ...readColumnAlignsAttribute(xmlNode),
        children,
        colWidths: colWidths.length > 0 ? colWidths : undefined,
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      });
    });

    litexmlService.registerXMLReader('tr', (_xmlNode, children) => {
      return INodeHelper.createElementNode(TableRowNode.getType(), {
        children,
        direction: 'ltr',
        format: '',
        height: 33,
        indent: 0,
        version: 1,
      });
    });

    const tdReader = (xmlNode: Element, children: any[]) => {
      return INodeHelper.createElementNode(TableCellNode.getType(), {
        backgroundColor: xmlNode.getAttribute('backgroundColor') || null,
        children,
        colSpan: xmlNode.getAttribute('colSpan')
          ? parseInt(xmlNode.getAttribute('colSpan') as string, 10)
          : 1,
        direction: 'ltr',
        format: '',
        headerState: 0,
        indent: 0,
        rowSpan: xmlNode.getAttribute('rowSpan')
          ? parseInt(xmlNode.getAttribute('rowSpan') as string, 10)
          : 1,
        version: 1,
      });
    };
    litexmlService.registerXMLReader('th', tdReader);
    litexmlService.registerXMLReader('td', tdReader);
  }

  registerMarkdown() {
    const markdownService = this.kernel.requireService(IMarkdownShortCutService);

    if (!markdownService) {
      return;
    }

    markdownService.registerMarkdownWriter(TableNode.getType(), (ctx) => {
      ctx.wrap('', '\n');
    });
    markdownService.registerMarkdownWriter(TableRowNode.getType(), (ctx, node) => {
      const parent = node.getParent();
      if (!$isTableNode(parent)) {
        return;
      }
      const hasPreviousProjectedRow = node
        .getPreviousSiblings()
        .some((sibling) => !isRemovedTableRowDiff(sibling));
      if (!hasPreviousProjectedRow) {
        ctx.wrap('', `\n${$getTableMarkdownDelimiterRow(parent)}\n`);
      } else {
        ctx.wrap('', '\n');
      }
    });

    markdownService.registerMarkdownWriter(TableCellNode.getType(), (ctx, node) => {
      ctx.addProcessor(tableCellProcessor);
      if (!node.getNextSibling()) {
        ctx.wrap('|', '|');
      } else {
        ctx.wrap('|', '');
      }
    });

    markdownService.registerMarkdownReader('table', (node, children) => {
      return INodeHelper.createElementNode('table', {
        ...readMarkdownColumnAligns(node.align),
        children,
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      });
    });

    markdownService.registerMarkdownReader('tableRow', (_node, children) => {
      return INodeHelper.createElementNode('tablerow', {
        children,
        direction: 'ltr',
        format: '',
        height: 33,
        indent: 0,
        version: 1,
      });
    });

    markdownService.registerMarkdownReader('tableCell', (_node, children) => {
      return INodeHelper.createElementNode('tablecell', {
        backgroundColor: null,
        children,
        colSpan: 1,
        direction: 'ltr',
        format: '',
        headerState: 0,
        indent: 0,
        rowSpan: 1,
        version: 1,
      });
    });
  }
};
