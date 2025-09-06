import { $getRoot, $getSelection, LexicalEditor } from 'lexical';

import { DataSource } from '@/editor-kernel';
import { IWriteOptions } from '@/editor-kernel/data-source';
import { INodeHelper } from '@/editor-kernel/inode/helper';

export default class TextDataSource extends DataSource {
  read(editor: LexicalEditor, data: string) {
    if (typeof data !== 'string') {
      throw new Error('Invalid data type ' + typeof data);
    }
    const lines = data.split(/\n/g);
    const rootNode = INodeHelper.createRootNode();
    lines.forEach((line) => {
      const paragraph = INodeHelper.createParagraph();
      if (line) {
        const textNode = INodeHelper.createTextNode(line);
        INodeHelper.appendChild(paragraph, textNode);
      }
      INodeHelper.appendChild(rootNode, paragraph);
    });

    editor.setEditorState(editor.parseEditorState({ root: rootNode } as any));
  }

  write(editor: LexicalEditor, options?: IWriteOptions): any {
    if (options?.selection) {
      return editor.read(() => {
        const selection = $getSelection();
        return selection ? selection.getTextContent().replaceAll('\uFEFF', '') : null;
      });
    }
    return editor.getEditorState().read(() => {
      return $getRoot().getTextContent().replaceAll('\uFEFF', '');
    });
  }
}
