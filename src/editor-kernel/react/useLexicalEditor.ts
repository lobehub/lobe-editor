import { LexicalEditor } from 'lexical';
import { useEffect } from 'react';

import { useLexicalComposerContext } from './react-context';

export function useLexicalEditor(
  handleEditor: (lexicalEditor: LexicalEditor) => (() => void) | undefined,
  deps: any[] = [],
) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    let lexicalEditor = editor.getLexicalEditor();
    if (lexicalEditor) {
      return handleEditor(lexicalEditor);
    } else {
      let remove: undefined | (() => void) = undefined;
      const handle = (editor: LexicalEditor) => {
        remove = handleEditor(editor);
      };
      editor.on('initialized', handle);
      return () => {
        editor.off('initialized', handle);
        remove?.();
      };
    }
  }, deps);
}
