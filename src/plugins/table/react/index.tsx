'use client';

import { $findTableNode, $getElementForTableNode, $isTableSelection } from '@lexical/table';
import EventEmitter from 'eventemitter3';
import { $getSelection, $isRangeSelection, LexicalEditor } from 'lexical';
import { type FC, useLayoutEffect, useMemo, useState } from 'react';

import { useLexicalEditor } from '@/editor-kernel/react';
import PortalAnchor from '@/editor-kernel/react/PortalAnchor';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';

import { TablePlugin } from '../plugin';
import { $updateDOMForSelection } from '../utils';
import TableActionMenuPlugin from './TableActionMenu';
import TableHoverActionsPlugin from './TableHoverActions';
import TableCellResizePlugin from './TableResize';
import { useStyles } from './style';
import { ReactTablePluginProps } from './type';

export const ReactTablePlugin: FC<ReactTablePluginProps> = ({ className, locale }) => {
  const { cx, styles } = useStyles();
  const [editor] = useLexicalComposerContext();
  const [lexicalEditor, setLexicalEditor] = useState<LexicalEditor | null>(null);
  const eventEmitter = useMemo(() => {
    return new EventEmitter();
  }, []);

  useLayoutEffect(() => {
    if (locale) {
      editor.registerLocale(locale);
    }
    editor.registerPlugin(TablePlugin, {
      theme: cx(styles, className),
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
        <PortalAnchor>
          <TableActionMenuPlugin editor={lexicalEditor} />
          <TableHoverActionsPlugin editor={lexicalEditor} />
        </PortalAnchor>
      </>
    )
  );
};
