import { $getRoot, LexicalEditor } from 'lexical';

import { DataSource } from '@/editor-kernel';

import { IMarkdownShortCutService } from '../service/shortcut';

export default class MarkdownDataSource extends DataSource {
  constructor(
    protected dataType: string,
    protected markdownService: IMarkdownShortCutService,
  ) {
    super(dataType);
  }

  read() {
    throw new Error('MarkdownDataSource not implemented yet!');
  }

  write(editor: LexicalEditor): any {
    const rootNode = editor.getEditorState().read(() => {
      return $getRoot();
    });
    console.info('MarkdownDataSource write', rootNode);
  }
}
