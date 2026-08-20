'use client';

import { type FC, useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react';
import { INodePlugin } from '@/plugins/inode';

import { LitexmlPlugin } from '../plugin';
import ReactDiffNodeToolbar from './DiffNodeToolbar';
import { styles, tableCellDiffStyles, tableRowDiffStyles } from './style';
import TableRowDiffToolbar from './TableRowDiffToolbar';

export const ReactLiteXmlPlugin: FC<void> = () => {
  const [editor] = useLexicalComposerContext();
  const lexicalEditor = editor.getLexicalEditor();

  useLayoutEffect(() => {
    editor.registerPlugin(INodePlugin);
    editor.registerPlugin(LitexmlPlugin, {
      decorator: (node, editor) => <ReactDiffNodeToolbar editor={editor} node={node} />,
      tableRowDiffTheme: tableRowDiffStyles,
      tableCellDiffTheme: tableCellDiffStyles,
      theme: styles,
    });
  }, [editor]);

  return lexicalEditor ? <TableRowDiffToolbar editor={lexicalEditor} /> : null;
};

ReactLiteXmlPlugin.displayName = 'ReactLiteXmlPlugin';

export default ReactLiteXmlPlugin;
