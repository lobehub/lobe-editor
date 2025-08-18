import { TableNode } from '@lexical/table';
import { EditorConfig, LexicalEditor } from 'lexical/LexicalEditor';

const OriginalCreateDOM = TableNode.prototype.createDOM;

export function patchTableNode() {
  Object.defineProperty(TableNode.prototype, 'createDOM', {
    configurable: true,
    enumerable: false,
    value: function (config: EditorConfig, editor?: LexicalEditor) {
      const table = OriginalCreateDOM.call(this, config, editor);
      const controller = document.createElement('div');
      table.append(controller);
      return table;
    },
    writable: true,
  });
}

export { TableNode } from '@lexical/table';
