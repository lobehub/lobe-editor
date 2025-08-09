import { LexicalEditor } from 'lexical';
import type { FC } from 'react';
import { useLayoutEffect, useState } from 'react';

import { useLexicalEditor } from '@/editor-kernel/react';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';

import { TablePlugin } from '../plugin';
import { TableCellResizeMemo } from './resize';
import { useStyles } from './style';

export interface ReactTablePluginProps {
  className?: string;
}

export const ReactTablePlugin: FC<ReactTablePluginProps> = () => {
  const { styles } = useStyles();
  const [editor] = useLexicalComposerContext();
  const [lexicalEditor, setLexicalEditor] = useState<LexicalEditor | null>(null);

  useLayoutEffect(() => {
    editor.registerPlugin(TablePlugin, {
      className: styles,
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
