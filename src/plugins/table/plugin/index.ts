import {
  $createTableNodeWithDimensions,
  $findTableNode,
  $isTableNode,
  TableCellNode,
  TableNode,
  TableRowNode,
  registerTableCellUnmergeTransform,
  registerTablePlugin,
  registerTableSelectionObserver,
} from '@lexical/table';
import { $insertNodeToNearestRoot } from '@lexical/utils';
import { cx } from 'antd-style';
import {
  $getPreviousSelection,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_EDITOR,
  LexicalEditor,
} from 'lexical';

import { IEditorPlugin } from '@/editor-kernel';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { IEditorKernel, IEditorPluginConstructor } from '@/editor-kernel/types';
import { IMarkdownShortCutService } from '@/plugins/markdown';

import { INSERT_TABLE_COMMAND } from '../command';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface TablePluginOptions {
  className?: string;
}

const tableCellProcessor = (before: string, content: string, after: string) => {
  return before + content.replace(/\n+$/, '').replace(/\n+/, '<br />') + after;
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
      table: cx(options?.className, 'editor_table'),
      tableCell: 'editor_table_cell',
      tableCellHeader: 'editor_table_cell_header',
      tableCellSelected: 'editor_table_cell_selected',
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
    this.register(registerTablePlugin(editor));
    this.register(registerTableSelectionObserver(editor));
    this.register(registerTableCellUnmergeTransform(editor));
    this.register(
      editor.registerCommand(
        INSERT_TABLE_COMMAND,
        ({ rows, columns, includeHeaders }) => {
          const selection = $getSelection() || $getPreviousSelection();
          if (!selection || !$isRangeSelection(selection)) {
            return false;
          }

          // Prevent nested tables by checking if we're already inside a table
          if ($findTableNode(selection.anchor.getNode())) {
            return false;
          }

          const anchorNode = selection.anchor.getNode();

          const tableNode = $createTableNodeWithDimensions(
            Number(rows),
            Number(columns),
            includeHeaders,
          );

          if ($isElementNode(anchorNode) && anchorNode.isEmpty()) {
            anchorNode.replace(tableNode);
          } else {
            $insertNodeToNearestRoot(tableNode);
          }

          const firstDescendant = tableNode.getFirstDescendant();
          if ($isTextNode(firstDescendant)) {
            firstDescendant.select();
          }

          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
    );
  }
};
