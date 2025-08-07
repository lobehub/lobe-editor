import { useCallback, useEffect, useRef } from "react";
import { FileTypeIcon, FileTypeIconProps } from '@lobehub/ui';
import { CLICK_COMMAND, COMMAND_PRIORITY_LOW, LexicalEditor } from "lexical";
import { FileNode } from "../node/FileNode";
import { useLexicalNodeSelection } from "@/editor-kernel/react/useLexicalNodeSelection";

export const ReactFile = (props: { className?: string; editor: LexicalEditor; node: FileNode; }) => {
    const { node, editor } = props;
    const spanRef = useRef<HTMLSpanElement>(null);
    const [isSelect, setSelected, clearSelection] = useLexicalNodeSelection(node.getKey());

    console.info('------------------>', isSelect);
    const onClick = useCallback((payload: MouseEvent) => {
        if (payload.target === spanRef.current) {
            clearSelection();
            setSelected(true);
            return true; // Indicate that the click was handled
        }
        return false;
    }, [clearSelection, setSelected]);

    useEffect(() => {
        // Perform any necessary side effects here
        return editor.registerCommand<MouseEvent>(
            CLICK_COMMAND,
            onClick,
            COMMAND_PRIORITY_LOW,
        );
    }, [editor, node, onClick]);

    if (node.status === 'pending') {
        return <div className={props.className}>File is pending upload...</div>;
    }

    if (node.status === 'error') {
        return <div className={props.className}>Error: {node.message}</div>;
    }

    return (
        <span className={props.className} ref={spanRef}>
            <FileTypeIcon filetype={node.name.split('.').pop() as FileTypeIconProps['filetype']} size={24} style={{
                verticalAlign: 'middle',
            }} />
            {node.name}
        </span>
    );
}
