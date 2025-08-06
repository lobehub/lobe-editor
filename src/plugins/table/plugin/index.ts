import { IEditorPlugin } from "@/editor-kernel";
import { KernelPlugin } from "@/editor-kernel/plugin";
import { IEditorKernel, IEditorPluginConstructor } from "@/editor-kernel/types";
import { $createTableNodeWithDimensions, $findTableNode, registerTableCellUnmergeTransform, registerTablePlugin, registerTableSelectionObserver, TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { $getPreviousSelection, $getSelection, $isElementNode, $isRangeSelection, $isTextNode, COMMAND_PRIORITY_EDITOR, LexicalEditor } from "lexical";
import { INSERT_TABLE_COMMAND } from "../command";
import { $insertNodeToNearestRoot } from "@lexical/utils";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface TablePluginOptions {
    className?: string;
    tableCellClassName?: string;
    tableCellHeaderClassName?: string;
    tableCellSelectedClassName?: string;
}

export const TablePlugin: IEditorPluginConstructor<TablePluginOptions> =
    class extends KernelPlugin implements IEditorPlugin<TablePluginOptions> {
        static pluginName = "TablePlugin";

        constructor(protected kernel: IEditorKernel, options?: TablePluginOptions) {
            super();
            // Register the horizontal rule node
            kernel.registerNodes([TableNode, TableRowNode, TableCellNode]);
            kernel.registerThemes({
                'table': options?.className || 'editor_table',
                'tableCell': options?.tableCellClassName || 'editor_table_cell',
                'tableCellHeader': options?.tableCellHeaderClassName || 'editor_table_cell_header',
                'tableCellSelected': options?.tableCellSelectedClassName || 'editor_table_cell_selected',
            });
        }

        onInit(editor: LexicalEditor): void {
            this.register(registerTablePlugin(editor));
            this.register(registerTableSelectionObserver(editor));
            this.register(registerTableCellUnmergeTransform(editor));
            this.register(editor.registerCommand(INSERT_TABLE_COMMAND, ({
                rows,
                columns,
                includeHeaders,
            }) => {
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
            }, COMMAND_PRIORITY_EDITOR));
        }
    }
