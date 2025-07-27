import React, { useEffect, useMemo } from 'react';
import { ImageNode } from '../node/image-node';
import { useLexicalNodeSelection } from '@/editor-kernel/react/useLexicalNodeSelection';
import { useLexicalEditor } from '@/editor-kernel/react/useLexicalEditor';
import { BrokenImage } from './brokerImage';
import { LazyImage } from './lazyImage';
import { COMMAND_PRIORITY_LOW, SELECTION_CHANGE_COMMAND } from 'lexical';

export const Image = (props: {
    className?: string;
    node: ImageNode;
}) => {
    const { node } = props;
    const [isSelected, setSelected] = useLexicalNodeSelection(node.getKey());
    // const [isNodeSelect] = useState(false);

    useEffect(() => {
        if (isSelected) {
            console.log('Image selected:', node.getKey());
        } else {
            console.log('Image deselected:', node.getKey());
        }
    }, [isSelected, node]);

    useLexicalEditor((editor) => {
        editor.registerCommand(
            SELECTION_CHANGE_COMMAND,
            (_, activeEditor) => {
                console.info('Active editor:', activeEditor);
                return false;
            },
            COMMAND_PRIORITY_LOW,
        );
    }, []);

    const children = useMemo(() => {
        switch (node.status) {
            case 'error': {
                return <BrokenImage />;
            }
            case 'uploaded':
            case 'loading': {
                return <LazyImage className={props.className} node={node} />;
            }
            default: {
                return null;
            }
        }
    }, [node.status, props.className, node]);

    return (
        <div
            draggable={false}
            onClick={() => setSelected(true)}
            style={{
                border: isSelected ? '1px solid blue' : '1px solid transparent',
                display: 'inline-block',
            }}
        >
            {children}
        </div>
    );
};
