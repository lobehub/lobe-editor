import { $getRoot, LexicalEditor } from 'lexical';

import { DataSource } from '@/editor-kernel';
import { INodeHelper } from '@/editor-kernel/inode/helper';

export default class TextDataSource extends DataSource {
  read(editor: LexicalEditor, data: string) {
    if (typeof data !== 'string') {
      return console.error('Invalid data type ' + typeof data);
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

  write(editor: LexicalEditor): any {
    return editor.getEditorState().read(() => {
      return $getRoot().getTextContent();
    });
  }
}
