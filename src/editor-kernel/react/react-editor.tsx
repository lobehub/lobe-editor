/**
 * 支持通过 react children 进行配置
 */
import React, { ReactNode, useMemo } from 'react';
import { createLexicalComposerContext, LexicalComposerContext, LexicalComposerContextWithEditor } from './react-context';
import Editor from '../';

export interface IReactEditorProps {
    children?: ReactNode | undefined
}

export const ReactEditor: React.FC<IReactEditorProps> = (props) => {
    const composerContext = useMemo(() => {
        const editor = Editor.createEditor();
        const theme = createLexicalComposerContext(null, null);
        return [editor, theme] as LexicalComposerContextWithEditor;
    }, []);

    return (
        <LexicalComposerContext.Provider value={composerContext}>
            {props.children}
        </LexicalComposerContext.Provider>
    )
};
