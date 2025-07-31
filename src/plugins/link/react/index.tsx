import { useLexicalComposerContext } from "@/editor-kernel/react/react-context";
import React, { useLayoutEffect } from "react";
import { LinkPlugin } from "../plugin";
import { MarkdownPlugin } from "@/plugins/markdown";
import { HOVER_LINK_COMMAND, HOVER_OUT_LINK_COMMAND } from "../node/LinkNode";
import { COMMAND_PRIORITY_NORMAL } from "lexical";
import { useLexicalEditor } from "@/editor-kernel/react";
import { computePosition, flip, offset, shift } from '@floating-ui/dom';

import './index.less';

export interface ReactLinkPluginProps {
    className?: string;
}

export const ReactLinkPlugin: React.FC<ReactLinkPluginProps> = () => {
    const [editor] = useLexicalComposerContext();
    // const [hoveredLink, setHoveredLink] = useState<LinkNode | null>(null);
    const divRef = React.useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        console.info('ReactLinkPlugin: Initializing Codeblock Plugin');
        editor.registerPlugin(MarkdownPlugin);
        editor.registerPlugin(LinkPlugin, {
            decorator() {
                return <hr className="editor_horizontalRule" />;
            },
        });


    }, []);

    useLexicalEditor((editor) => {
        console.info('ReactLinkPlugin: Editor initialized', editor);
        editor.registerCommand(
            HOVER_LINK_COMMAND,
            (payload) => {
                console.info('Hover link command triggered:', payload);
                if (!payload.event.target || divRef.current === null) {
                    return false;
                }
                computePosition(payload.event.target as HTMLElement, divRef.current, {
                    middleware: [
                        offset(5),
                        flip(),
                        shift(),
                    ],
                    placement: 'top',
                }).then(({ x, y }) => {
                    if (!payload.event.target || divRef.current === null) {
                        return false;
                    }
                    divRef.current.style.left = `${x}px`;
                    divRef.current.style.top = `${y}px`;
                });
                return false;
            },
            COMMAND_PRIORITY_NORMAL,
        );
        editor.registerCommand(
            HOVER_OUT_LINK_COMMAND,
            () => {
                console.info('Hover link command cleared');
                if (divRef.current) {
                    divRef.current.style.left = '-9999px';
                    divRef.current.style.top = '-9999px';
                }
                return true;
            },
            COMMAND_PRIORITY_NORMAL,
        );
    }, []);


    return <div className="editor_linkPlugin" ref={divRef}>
        1231
    </div>;
}
