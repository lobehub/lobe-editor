import { mergeRegister } from '@lexical/utils';
import { $getNodeByKey, LexicalEditor } from 'lexical';

import { CodeNode } from '../node/code';

export function registerCodeInline(editor: LexicalEditor) {
  return mergeRegister(
    editor.registerUpdateListener(({ mutatedNodes }) => {
      const codeChanged = mutatedNodes?.get(CodeNode);
      const keys = codeChanged?.keys() || [];
      editor.read(() => {
        for (const key of keys) {
          const node = $getNodeByKey(key);
          if (!node) {
            return;
          }
          const parent = node.getParent();
          if (parent?.__last === key) {
            const codeElement = editor.getElementByKey(key);
            if (!codeElement?.nextSibling) {
              parent
                // @ts-expect-error not error
                .getDOMSlot(editor.getElementByKey(parent.getKey()))
                .setManagedLineBreak('decorator');
            }
          }
        }
      });
    }),
  );
}
