import { LexicalEditor } from 'lexical';

import { DataSource } from '@/editor-kernel';

export default class JSONDataSource extends DataSource {
  read(editor: LexicalEditor, data: any) {
    editor.setEditorState(editor.parseEditorState(data));
  }

  write(editor: LexicalEditor): any {
    return editor.getEditorState().toJSON();
  }
}
