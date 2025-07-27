import { useLexicalComposerContext } from "@/editor-kernel/react/react-context";
import React, { useLayoutEffect } from "react";
import { ImagePlugin } from "../plugin";
import { UploadPlugin } from "@/plugins/upload";
import { Image } from "./image";

export interface ReactImagePluginProps {
    className?: string;
}

export const ReactImagePlugin: React.FC<ReactImagePluginProps> = (props) => {
    const [editor] = useLexicalComposerContext();

    useLayoutEffect(() => {
        console.info('ReactImagePlugin: Initializing Image Plugin');
        editor.registerPlugin(UploadPlugin);
        editor.registerPlugin(ImagePlugin, {
            handleUpload(file) {
                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve({ url: URL.createObjectURL(file) });
                    }, 1000);
                });
            },
            renderImage: (node) => {
                return <Image className={props.className} node={node} />;
            },
        });
    }, []);


    return null;
}
