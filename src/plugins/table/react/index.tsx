import { LexicalEditor } from 'lexical';
import type { FC } from 'react';
import { useLayoutEffect, useState } from 'react';

import { useLexicalEditor } from '@/editor-kernel/react';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';

import { TablePlugin, TablePluginOptions } from '../plugin';
import { TableCellResizeMemo } from './resize';
import { useStyles } from './style';

export interface ReactTablePluginProps {
  className?: string;
  theme?: TablePluginOptions['theme'];
}

export const ReactTablePlugin: FC<ReactTablePluginProps> = ({ theme, className }) => {
  const [editor] = useLexicalComposerContext();
  const [lexicalEditor, setLexicalEditor] = useState<LexicalEditor | null>(null);

  const { cx, styles } = useStyles();

  useLayoutEffect(() => {
    editor.registerPlugin(TablePlugin, {
      theme: {
        table: cx(styles.editor_table, className, theme?.table),
        tableCell: cx(styles.editor_table_cell, className, theme?.tableCell),
        tableCellHeader: cx(styles.editor_table_cell_header, className, theme?.tableCellHeader),
        tableCellSelected: cx(
          styles.editor_table_cell_selected,
          className,
          theme?.tableCellSelected,
        ),
      },
    });
  }, []);

  useLexicalEditor((editor) => {
    setLexicalEditor(editor);
    return () => {
      setLexicalEditor(null);
    };
  }, []);

  return lexicalEditor && <TableCellResizeMemo editor={lexicalEditor} />;
};
