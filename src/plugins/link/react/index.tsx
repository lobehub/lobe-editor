import { useLexicalComposerContext } from "@/editor-kernel/react/react-context";
import React, { useLayoutEffect, useRef } from "react";
import { LinkPlugin } from "../plugin";
import { isModifierMatch, COMMAND_PRIORITY_EDITOR, COMMAND_PRIORITY_LOW, COMMAND_PRIORITY_NORMAL, KEY_DOWN_COMMAND, $getSelection, $isRangeSelection } from 'lexical';
import { MarkdownPlugin } from "@/plugins/markdown";
import { $isLinkNode, $toggleLink, HOVER_LINK_COMMAND, HOVER_OUT_LINK_COMMAND, LinkAttributes, TOGGLE_LINK_COMMAND } from "../node/LinkNode";
import { useLexicalEditor } from "@/editor-kernel/react";
import { computePosition, flip, offset, shift } from '@floating-ui/dom';

import './index.less';
import { CONTROL_OR_META } from "@/common/sys";
import { getSelectedNode, sanitizeUrl } from "../utils";

export interface ReactLinkPluginProps {
    attributes?: LinkAttributes;
    className?: string;
    validateUrl?: (url: string) => boolean;
}

export const ReactLinkPlugin: React.FC<ReactLinkPluginProps> = ({
    validateUrl,
    attributes,
}) => {
    const [editor] = useLexicalComposerContext();
    const state = useRef<{ isLink: boolean }>({ isLink: false });
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
        editor.registerUpdateListener(() => {
            const selection = editor.read(() => $getSelection());
            if (!selection)
                return;
            if ($isRangeSelection(selection)) {
                // Update links
                editor.read(() => {
                    const node = getSelectedNode(selection);
                    const parent = node.getParent();
                    const isLink = $isLinkNode(parent) || $isLinkNode(node);
                    state.current.isLink = isLink;
                });
            } else {
                state.current.isLink = false;
            }
            console.info('Editor update listener triggered');
            if (divRef.current) {
                divRef.current.style.left = '-9999px';
                divRef.current.style.top = '-9999px';
            }
        });
        editor.registerCommand(
            TOGGLE_LINK_COMMAND,
            (payload) => {
                if (payload === null) {
                    $toggleLink(payload);
                    return true;
                } else if (typeof payload === 'string') {
                    if (validateUrl === undefined || validateUrl(payload)) {
                        $toggleLink(payload, attributes);
                        return true;
                    }
                    return false;
                } else {
                    const { url, target, rel, title } = payload;
                    $toggleLink(url, {
                        ...attributes,
                        rel,
                        target,
                        title,
                    });
                    return true;
                }
            },
            COMMAND_PRIORITY_LOW,
        );
        editor.registerCommand(KEY_DOWN_COMMAND, e => {
            // ctrl + k / cmd + k
            if (
                isModifierMatch(e, CONTROL_OR_META) &&
                'KeyK' === e.code
            ) {
                const isLink = state.current.isLink;
                e.preventDefault();
                e.stopPropagation();
                editor.dispatchCommand(TOGGLE_LINK_COMMAND, isLink ? null : sanitizeUrl('https://'));
                return true;
            }
            return false;

        }, COMMAND_PRIORITY_EDITOR);
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
                    const url = editor.read(() => payload.linkNode.getURL());
                    divRef.current.innerHTML = url || '';
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
