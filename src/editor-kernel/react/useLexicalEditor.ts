import { LexicalEditor } from 'lexical';
import { useLexicalComposerContext } from './react-context';
import { useEffect } from 'react';

export function useLexicalEditor(handleEditor: (lexicalEditor: LexicalEditor) => (() => void) | void, deps: any[] = []) {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        let lexicalEditor = editor.getLexicalEditor();
        if(lexicalEditor) {
            return handleEditor(lexicalEditor);
        } else {
            editor.on('initialized', handleEditor);
            return () => {
                editor.off('initialized', handleEditor);
            };
        }
    }, deps);
}
