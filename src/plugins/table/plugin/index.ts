import {
  $isTableNode,
  TableCellNode,
  TableRowNode,
  registerTableCellUnmergeTransform,
  registerTablePlugin,
  registerTableSelectionObserver,
  setScrollableTablesActive,
} from '@lexical/table';
import { cx } from 'antd-style';
import { LexicalEditor } from 'lexical';

import { INodeHelper } from '@/editor-kernel/inode/helper';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { IMarkdownShortCutService } from '@/plugins/markdown';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { registerTableCommand } from '../command';
import { TableNode, patchTableNode } from '../node';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface TablePluginOptions {
  theme?: string;
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
    patchTableNode();
    // Register the horizontal rule node
    kernel.registerNodes([TableNode, TableRowNode, TableCellNode]);
    kernel.registerThemes({
      table: 'editor_table',
      tableCell: 'editor_table_cell',
      tableCellHeader: 'editor_table_cell_header',
      tableCellSelected: 'editor_table_cell_selected',
      tableScrollableWrapper: cx('editor_table_scrollable_wrapper', options?.theme),
    });
  }

  onInit(editor: LexicalEditor): void {
    setScrollableTablesActive(editor, true);
    this.register(registerTablePlugin(editor));
    this.register(registerTableSelectionObserver(editor));
    this.register(registerTableCellUnmergeTransform(editor));
    this.register(registerTableCommand(editor));

    this.registerMarkdown();
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
        // eslint-disable-next-line unicorn/no-new-array
        colWidths: new Array(colLen).fill(750 / colLen),
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
