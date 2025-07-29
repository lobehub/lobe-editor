import { useLexicalComposerContext } from "@/editor-kernel/react/react-context";
import React, { useLayoutEffect } from "react";
import { HRPlugin } from "../plugin";
import { MarkdownPlugin } from "@/plugins/markdown";

import './index.less';

export interface ReactHRPluginProps {
    className?: string;
}

export const ReactHRPlugin: React.FC<ReactHRPluginProps> = () => {
    const [editor] = useLexicalComposerContext();

    useLayoutEffect(() => {
        console.info('ReactHRPlugin: Initializing Codeblock Plugin');
        editor.registerPlugin(MarkdownPlugin);
        editor.registerPlugin(HRPlugin, {
            decorator() {
                return <hr className="editor_horizontalRule" />;
            },
        });
    }, []);


    return null;
}
