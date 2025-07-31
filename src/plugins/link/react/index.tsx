import { useLexicalComposerContext } from "@/editor-kernel/react/react-context";
import React, { useLayoutEffect } from "react";
import { LinkPlugin } from "../plugin";
import { MarkdownPlugin } from "@/plugins/markdown";

import './index.less';

export interface ReactLinkPluginProps {
    className?: string;
}

export const ReactLinkPlugin: React.FC<ReactLinkPluginProps> = () => {
    const [editor] = useLexicalComposerContext();

    useLayoutEffect(() => {
        console.info('ReactLinkPlugin: Initializing Codeblock Plugin');
        editor.registerPlugin(MarkdownPlugin);
        editor.registerPlugin(LinkPlugin, {
            decorator() {
                return <hr className="editor_horizontalRule" />;
            },
        });
    }, []);


    return null;
}
