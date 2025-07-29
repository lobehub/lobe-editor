import { useLexicalComposerContext } from "@/editor-kernel/react/react-context";
import React, { useLayoutEffect } from "react";
import { ListPlugin } from "../plugin";

import './index.less';

export interface ReactListPluginProps {
    className?: string;
}

export const ReactListPlugin: React.FC<ReactListPluginProps> = () => {
    const [editor] = useLexicalComposerContext();

    useLayoutEffect(() => {
        console.info('ReactListPlugin: Initializing List Plugin');
        editor.registerPlugin(ListPlugin);
    }, []);


    return null;
}
