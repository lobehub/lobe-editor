import {
  $isTableNode,
  TableCellNode,
  TableNode,
  TableRowNode,
  registerTableCellUnmergeTransform,
  registerTablePlugin,
  registerTableSelectionObserver,
  setScrollableTablesActive,
} from '@lexical/table';
import { cx } from 'antd-style';
import { LexicalEditor } from 'lexical';

import { IEditorPlugin } from '@/editor-kernel';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { IEditorKernel, IEditorPluginConstructor } from '@/editor-kernel/types';
import { IMarkdownShortCutService } from '@/plugins/markdown';

import { registerTableCommand } from '../command';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface TablePluginOptions {
  className?: string;
}

const tableCellProcessor = (before: string, content: string, after: string) => {
  return before + content.replace(/\n+$/, '').replaceAll(/\n+/g, '<br />') + after;
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
    // Register the horizontal rule node
    kernel.registerNodes([TableNode, TableRowNode, TableCellNode]);
    kernel.registerThemes({
      table: 'editor_table',
      tableCell: 'editor_table_cell',
      tableCellHeader: 'editor_table_cell_header',
      tableCellSelected: 'editor_table_cell_selected',
      tableScrollableWrapper: cx(options?.className, 'editor_table_scrollable_wrapper'),
    });

    kernel
      .requireService(IMarkdownShortCutService)
      ?.registerMarkdownWriter(TableNode.getType(), (ctx) => {
        ctx.wrap('', '\n');
      });
    kernel
      .requireService(IMarkdownShortCutService)
      ?.registerMarkdownWriter(TableRowNode.getType(), (ctx, node) => {
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

    kernel
      .requireService(IMarkdownShortCutService)
      ?.registerMarkdownWriter(TableCellNode.getType(), (ctx, node) => {
        ctx.addProcessor(tableCellProcessor);
        if (!node.getNextSibling()) {
          ctx.wrap('|', '|');
        } else {
          ctx.wrap('|', '');
        }
      });
  }

  onInit(editor: LexicalEditor): void {
    setScrollableTablesActive(editor, true);
    this.register(registerTablePlugin(editor));
    this.register(registerTableSelectionObserver(editor));
    this.register(registerTableCellUnmergeTransform(editor));
    this.register(registerTableCommand(editor));
  }
};
