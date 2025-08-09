import { LexicalEditor } from 'lexical';
import type { FC } from 'react';
import { useLayoutEffect, useState } from 'react';

import { useLexicalEditor } from '@/editor-kernel/react';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';

import { TablePlugin } from '../plugin';
import './index.less';
import { TableCellResizeMemo } from './resize';

export interface ReactTablePluginProps {
  className?: string;
}

export const ReactTablePlugin: FC<ReactTablePluginProps> = () => {
  const [editor] = useLexicalComposerContext();
  const [lexicalEditor, setLexicalEditor] = useState<LexicalEditor | null>(null);

  useLayoutEffect(() => {
    editor.registerPlugin(TablePlugin);
  }, []);

  useLexicalEditor((editor) => {
    setLexicalEditor(editor);
    return () => {
      setLexicalEditor(null);
    };
  }, []);

  return lexicalEditor && <TableCellResizeMemo editor={lexicalEditor} />;
};
