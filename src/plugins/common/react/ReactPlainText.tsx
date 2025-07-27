import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import React, { useEffect, useLayoutEffect } from 'react';
import { CommonPlugin } from '../plugin';
import { useDecorators } from '@/editor-kernel/react/useDecorators';
import { LexicalErrorBoundary } from '@/editor-kernel/react/LexicalErrorBoundary';

export interface IReactEditorContent {
    content: any;
    type: string;
}

export const ReactEditorContent: React.FC<IReactEditorContent> = () => {
    return null;
};

export interface ReactPlainTextProps {
    children: React.ReactElement<IReactEditorContent>;
    className?: string;
    style?: React.CSSProperties;
}

export const ReactPlainText: React.FC<ReactPlainTextProps> = (props) => {
    const editorContainerRef = React.useRef<HTMLDivElement>(null);
    const [editor] = useLexicalComposerContext();
    const decorators = useDecorators(editor, LexicalErrorBoundary);

    useLayoutEffect(() => {
        editor.registerPlugin(CommonPlugin);
        console.info('ReactPlainText: Plugin registered');
    }, []);

    useEffect(() => {
        console.info('ReactPlainText: Layout effect triggered');
        const container = editorContainerRef.current;
        if (container) {
            // Initialize the editor
            editor.setRootElement(container);
        }
        const { props: { type, content } } = React.Children.only(props.children);
        editor.setDocument(type, content);
    }, []);

    return (
        <>
            <div
                className={props.className}
                contentEditable
                ref={editorContainerRef}
                style={props.style}
            />
            {decorators}
        </>
    );
};
