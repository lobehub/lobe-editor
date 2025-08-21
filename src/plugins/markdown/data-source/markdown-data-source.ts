import { $getRoot, $isElementNode, LexicalEditor, LexicalNode } from 'lexical';

import { DataSource } from '@/editor-kernel';

import { MarkdownShortCutService } from '../service/shortcut';
import { MarkdownWriterContext } from './markdown-writer-context';

export default class MarkdownDataSource extends DataSource {
  constructor(
    protected dataType: string,
    protected markdownService: MarkdownShortCutService,
  ) {
    super(dataType);
  }

  read() {
    return console.error('MarkdownDataSource not implemented yet!');
  }

  write(editor: LexicalEditor): any {
    return editor.getEditorState().read(() => {
      const rootNode = $getRoot();
      const rootCtx = new MarkdownWriterContext();
      const processChild = (parentCtx: MarkdownWriterContext, child: LexicalNode) => {
        const writer = this.markdownService.markdownWriters[child.getType()];
        let currentCtx = parentCtx;
        if ($isElementNode(child)) {
          currentCtx = currentCtx.newChild();
        }
        if (writer) {
          writer(currentCtx, child);
        }
        if ($isElementNode(child)) {
          child.getChildren().forEach((child) => processChild(currentCtx, child));
        }
      };
      rootNode.getChildren().forEach((child) => processChild(rootCtx, child));
      return rootCtx.toString();
    });
  }
}
