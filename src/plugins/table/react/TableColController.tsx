import { TableNode } from '@lexical/table';
import { LexicalEditor } from 'lexical';
import { memo, useMemo } from 'react';

import { LexicalPortalContainer } from '@/editor-kernel/react';

import { MIN_COLUMN_WIDTH } from './TableResize/style';

interface TableColControllerProps {
  editor: LexicalEditor;
  node: TableNode;
}

const CONTROL_SIZE = 14;

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
        <div
          className="top"
          style={{
            display: 'flex',
            height: CONTROL_SIZE,
            left: 0,
            position: 'relative',
            top: 0,
          }}
        >
          {colWidths.map((width, index) => (
            <div
              className="col"
              key={index}
              style={{
                backgroundColor: '#1f1f1f',
                borderColor: 'rgba(255, 255, 255, 0.12)',
                borderStyle: 'solid',
                borderWidth: index + 1 === colWidths.length ? '1px 1px 0 1px' : '1px 0 0 1px',
                cursor: 'pointer',
                height: CONTROL_SIZE,
                position: 'relative',
                width: index + 1 === colWidths.length ? width + 0.5 : width,
              }}
            />
          ))}
        </div>
      </div>
    </LexicalPortalContainer>
  );
});

TableColController.displayName = 'TableColController';

export default TableColController;
