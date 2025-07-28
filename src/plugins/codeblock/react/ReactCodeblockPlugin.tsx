import { useLexicalComposerContext } from "@/editor-kernel/react/react-context";
import React, { useLayoutEffect } from "react";
import { CodeblockPlugin } from "../plugin";
import { MarkdownPlugin } from "@/plugins/markdown";

export interface ReactCodeblockPluginProps {
    className?: string;
}

export const ReactCodeblockPlugin: React.FC<ReactCodeblockPluginProps> = () => {
    const [editor] = useLexicalComposerContext();

    useLayoutEffect(() => {
        console.info('ReactCodeblockPlugin: Initializing Codeblock Plugin');
        editor.registerPlugin(MarkdownPlugin);
        editor.registerPlugin(CodeblockPlugin);
    }, []);


    return null;
}
