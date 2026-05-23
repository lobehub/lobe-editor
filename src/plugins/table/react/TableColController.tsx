import { TableNode } from '@lexical/table';
import { cx } from 'antd-style';
import { LexicalEditor } from 'lexical';
import { memo, useMemo } from 'react';

import { LexicalPortalContainer } from '@/editor-kernel/react';

import { styles } from './TableController/style';
import { MIN_COLUMN_WIDTH } from './TableResize/style';

interface TableColControllerProps {
  editor: LexicalEditor;
  node: TableNode;
}

const readTableControllerState = (editor: LexicalEditor, node: TableNode) => {
  return editor.getEditorState().read(() => {
    const latestNode = node.getLatest();
    const columnCount = latestNode.getColumnCount();
    const colWidths = latestNode.getColWidths();

    return {
      colWidths: Array.from(
        { length: columnCount },
        (_, index) => colWidths?.[index] || MIN_COLUMN_WIDTH,
      ),
    };
  });
};

const TableColController = memo<TableColControllerProps>(({ editor, node }) => {
  const { colWidths } = useMemo(() => readTableControllerState(editor, node), [editor, node]);

  return (
    <LexicalPortalContainer editor={editor} node={node}>
      <div className="table-controller-col" contentEditable={false}>
        <div className={cx('top', styles.colTop)}>
          {colWidths.map((width, index) => {
            const isLastCol = index + 1 === colWidths.length;

            return (
              <div
                className={cx('col', styles.col, isLastCol && styles.colLast)}
                key={index}
                style={{
                  width: isLastCol ? width + 0.5 : width,
                }}
              />
            );
          })}
        </div>
      </div>
    </LexicalPortalContainer>
  );
});

TableColController.displayName = 'TableColController';

export default TableColController;
