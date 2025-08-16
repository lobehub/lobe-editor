'use client';

import { $findTableNode, $getElementForTableNode, $isTableSelection } from '@lexical/table';
import EventEmitter from 'eventemitter3';
import { $getSelection, $isRangeSelection, LexicalEditor } from 'lexical';
import type { FC } from 'react';
import { useLayoutEffect, useMemo, useState } from 'react';

import { useLexicalEditor } from '@/editor-kernel/react';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';

import { TablePlugin } from '../plugin';
import { $updateDOMForSelection } from '../utils';
import TableActionMenuPlugin from './TableActionMenu';
import TableHoverActionsPlugin from './TableHoverActions';
import TableCellResizePlugin from './TableResize';
import { useStyles } from './style';
import { ReactTablePluginProps } from './type';

export const ReactTablePlugin: FC<ReactTablePluginProps> = (props) => {
  const { styles } = useStyles();
  const [editor] = useLexicalComposerContext();
  const [lexicalEditor, setLexicalEditor] = useState<LexicalEditor | null>(null);
  const eventEmitter = useMemo(() => {
    return new EventEmitter();
  }, []);

  useLayoutEffect(() => {
    editor.registerI18n(
      props.i18n || {
        'table.delete': 'Delete table',
        'table.deleteColumn': 'Delete column',
        'table.deleteRow': 'Delete row',
        'table.insertColumnLeft': 'Insert {count} column(s) to the left',
        'table.insertColumnRight': 'Insert {count} column(s) to the right',
        'table.insertRowAbove': 'Insert {count} row(s) above',
        'table.insertRowBelow': 'Insert {count} row(s) below',
      },
    );
    editor.registerPlugin(TablePlugin, {
      className: styles,
    });
  }, []);

  useLexicalEditor((editor) => {
    setLexicalEditor(editor);
    editor.registerUpdateListener(() => {
      editor.read(() => {
        const selection = $getSelection();
        if (!$isTableSelection(selection) && !$isRangeSelection(selection)) {
          return null;
        }
        const tableNode = $findTableNode(selection.anchor.getNode());
        if (!tableNode) {
          return null;
        }
        $updateDOMForSelection(editor, $getElementForTableNode(editor, tableNode), selection);
      });
    });
    return () => {
      setLexicalEditor(null);
    };
  }, []);

  return (
    lexicalEditor && (
      <>
        <TableCellResizePlugin editor={lexicalEditor} eventEmitter={eventEmitter} />
        <TableActionMenuPlugin editor={lexicalEditor} />
        <TableHoverActionsPlugin editor={lexicalEditor} />
      </>
    )
  );
};
