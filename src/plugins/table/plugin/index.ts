import {
  $deleteTableColumnAtSelection,
  $deleteTableRowAtSelection,
  $isTableNode,
  TableCellNode,
  TableRowNode,
  registerTableCellUnmergeTransform,
  registerTablePlugin,
  registerTableSelectionObserver,
  setScrollableTablesActive,
} from '@lexical/table';
import { LexicalEditor } from 'lexical';
import type { ReactNode } from 'react';

import { INodeHelper } from '@/editor-kernel/inode/helper';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { ILitexmlService } from '@/plugins/litexml';
import { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';
import type { IDecorator, IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';
import { cx } from '@/utils/cx';

import {
  INSERT_TABLE_COLUMN_COMMAND,
  INSERT_TABLE_ROW_COMMAND,
  registerTableCommand,
} from '../command';
import { TableNode, patchTableNode } from '../node';
import { ITableControllerMenuService, TableControllerMenuService } from '../service';
import { createDefaultTableColWidths } from '../utils';

export interface TablePluginOptions {
  decoratorCol?: (node: TableNode, editor: LexicalEditor) => ReactNode;
  decoratorRow?: (node: TableNode, editor: LexicalEditor) => ReactNode;
  theme?: string;
}

const tableCellProcessor = (before: string, content: string, after: string) => {
  return before + content.replace(/\n+$/, '').replaceAll(/\n+/g, '<br />') + after;
};

function isHeadlessEditor(editor: LexicalEditor): boolean {
  return editor._headless === true;
}

const getSelectedRange = (selectedIndexes: number[]) => {
  const sortedIndexes = [...selectedIndexes].sort((a, b) => a - b);

  return {
    end: sortedIndexes.at(-1) ?? 0,
    start: sortedIndexes[0] ?? 0,
  };
};

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

    if (options?.decoratorCol || options?.decoratorRow) {
      kernel.registerDecorator(TableNode.getType(), {
        multi: [
          ...(options.decoratorCol
            ? [
                {
                  queryDOM: (el: HTMLElement) => el.querySelector('.toolbar-col') as HTMLElement,
                  render: (node: any, editor: LexicalEditor) => {
                    return options.decoratorCol?.(node as TableNode, editor) || null;
                  },
                },
              ]
            : []),
          ...(options.decoratorRow
            ? [
                {
                  queryDOM: (el: HTMLElement) => el.querySelector('.toolbar-row') as HTMLElement,
                  render: (node: any, editor: LexicalEditor) => {
                    return options.decoratorRow?.(node as TableNode, editor) || null;
                  },
                },
              ]
            : []),
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

    if (!isHeadlessEditor(editor)) {
      setScrollableTablesActive(editor, true);
      this.register(registerTablePlugin(editor));
      this.register(registerTableSelectionObserver(editor));
      this.register(registerTableCommand(editor));
    }

    this.registerMarkdown();
    this.registerLiteXml();
    this.registerControllerMenu();
  }

  registerControllerMenu() {
    const tableControllerMenuService = this.kernel.requireService(ITableControllerMenuService);
    if (!tableControllerMenuService) {
      return;
    }

    [
      tableControllerMenuService.registerItem({
        key: '__table_column_insert_before',
        label: 'Insert before',
        onClick: ({ editor, node, selectedIndexes }) => {
          const { start } = getSelectedRange(selectedIndexes);
          editor.dispatchCommand(INSERT_TABLE_COLUMN_COMMAND, {
            columnIndex: start,
            insertAfter: false,
            table: node.getKey(),
          });
        },
        order: 10,
        when: ({ axis }) => axis === 'column',
      }),
      tableControllerMenuService.registerItem({
        key: '__table_column_insert_after',
        label: 'Insert after',
        onClick: ({ editor, node, selectedIndexes }) => {
          const { end } = getSelectedRange(selectedIndexes);
          editor.dispatchCommand(INSERT_TABLE_COLUMN_COMMAND, {
            columnIndex: end,
            insertAfter: true,
            table: node.getKey(),
          });
        },
        order: 20,
        when: ({ axis }) => axis === 'column',
      }),
      tableControllerMenuService.registerItem({
        key: '__table_column_separator_delete',
        order: 30,
        type: 'separator',
        when: ({ axis }) => axis === 'column',
      }),
      tableControllerMenuService.registerItem({
        danger: true,
        key: '__table_column_delete',
        label: 'Delete',
        onClick: ({ editor }) => {
          editor.update(() => {
            $deleteTableColumnAtSelection();
          });
        },
        order: 40,
        preview: 'delete',
        when: ({ axis }) => axis === 'column',
      }),
      tableControllerMenuService.registerItem({
        key: '__table_row_insert_above',
        label: 'Insert above',
        onClick: ({ editor, node, selectedIndexes }) => {
          const { start } = getSelectedRange(selectedIndexes);
          editor.dispatchCommand(INSERT_TABLE_ROW_COMMAND, {
            insertAfter: false,
            rowIndex: start,
            table: node.getKey(),
          });
        },
        order: 10,
        when: ({ axis }) => axis === 'row',
      }),
      tableControllerMenuService.registerItem({
        key: '__table_row_insert_below',
        label: 'Insert below',
        onClick: ({ editor, node, selectedIndexes }) => {
          const { end } = getSelectedRange(selectedIndexes);
          editor.dispatchCommand(INSERT_TABLE_ROW_COMMAND, {
            insertAfter: true,
            rowIndex: end,
            table: node.getKey(),
          });
        },
        order: 20,
        when: ({ axis }) => axis === 'row',
      }),
      tableControllerMenuService.registerItem({
        key: '__table_row_separator_delete',
        order: 30,
        type: 'separator',
        when: ({ axis }) => axis === 'row',
      }),
      tableControllerMenuService.registerItem({
        danger: true,
        key: '__table_row_delete',
        label: 'Delete',
        onClick: ({ editor }) => {
          editor.update(() => {
            $deleteTableRowAtSelection();
          });
        },
        order: 40,
        preview: 'delete',
        when: ({ axis }) => axis === 'row',
      }),
    ].forEach((unregister) => {
      this.register(unregister);
    });
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
        ? colWidthsAttr.split(',').map((width) => parseInt(width, 10))
        : [];
      let maxTdlen = 1;
      for (const child of children) {
        if ((child.children?.length || -1) > maxTdlen) {
          maxTdlen = child.children.length;
        }
      }
      return INodeHelper.createElementNode(TableNode.getType(), {
        children,
        colWidths: colWidths.length > 0 ? colWidths : createDefaultTableColWidths(maxTdlen),
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
      if (!node.getPreviousSibling()) {
        ctx.wrap(
          '',
          `\n${parent
            .getColWidths()
            ?.map(() => {
              return '|:--';
            })
            .join('')}|\n`,
        );
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
      const colLen = node.children[0]?.children.length || 1;
      return INodeHelper.createElementNode('table', {
        children,
        colWidths: createDefaultTableColWidths(colLen),
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
