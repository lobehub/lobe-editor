import { $findTableNode, $getElementForTableNode, $isTableSelection } from '@lexical/table';
import EventEmitter from 'eventemitter3';
import { $getSelection, $isRangeSelection, LexicalEditor } from 'lexical';
import type { FC } from 'react';
import { useLayoutEffect, useMemo, useState } from 'react';

import { useLexicalEditor } from '@/editor-kernel/react';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';

import { TablePlugin } from '../plugin';
import { $updateDOMForSelection } from '../utils';
import TableActionMenuPlugin from './TableActionMenuPlugin';
import TableHoverActionsPlugin from './TableHoverActionsPlugin';
import { TableCellResizeMemo } from './resize';
import { useStyles } from './style';

export interface ReactTablePluginProps {
  className?: string;
}

export const ReactTablePlugin: FC<ReactTablePluginProps> = () => {
  const { styles } = useStyles();
  const [editor] = useLexicalComposerContext();
  const [lexicalEditor, setLexicalEditor] = useState<LexicalEditor | null>(null);
  const eventEmitter = useMemo(() => {
    return new EventEmitter();
  }, []);

  useLayoutEffect(() => {
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
        <TableCellResizeMemo editor={lexicalEditor} eventEmitter={eventEmitter} />
        <TableActionMenuPlugin editor={lexicalEditor} />
        <TableHoverActionsPlugin editor={lexicalEditor} />
      </>
    )
  );
};
