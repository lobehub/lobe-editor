import type { FC } from 'react';
import { LexicalEditor } from 'lexical';
import { useLayoutEffect, useState } from 'react';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { useLexicalEditor } from '@/editor-kernel/react';
import { TablePlugin } from '../plugin';
import { TableCellResizeMemo } from './resize';

import './index.less';

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
    }
  }, []);

  return lexicalEditor && <TableCellResizeMemo editor={lexicalEditor} />;
};

