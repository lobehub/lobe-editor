import { IEditorPlugin } from "@/editor-kernel";
import { KernelPlugin } from "@/editor-kernel/plugin";
import { IEditorKernel, IEditorPluginConstructor } from "@/editor-kernel/types";
import { IMarkdownShortCutService } from "@/plugins/markdown";
import { $createLinkNode, AutoLinkNode, LinkNode } from "@lexical/link";
import { $createTextNode } from "lexical";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface LinkPluginOptions {
}

export const LinkPlugin: IEditorPluginConstructor<LinkPluginOptions> =
    class extends KernelPlugin implements IEditorPlugin<LinkPluginOptions> {
        static pluginName = "LinkPlugin";

        constructor(protected kernel: IEditorKernel) {
            super();
            // Register the link nodes
            kernel.registerNodes([
                LinkNode,
                AutoLinkNode,
            ]);
            // Register themes for link nodes
            kernel.registerThemes({
                // Define themes for link nodes here
                link: 'editor_link',
            });

            kernel.requireService(IMarkdownShortCutService)?.registerMarkdownShortCut({
                regExp:
                    /\[([^[]+)]\(([^\s()]+)(?:\s"((?:[^"]*\\")*[^"]*)"\s*)?\)$/,
                replace: (textNode, match) => {
                    const [, linkText, linkUrl, linkTitle] = match;
                    const linkNode = $createLinkNode(linkUrl, { title: linkTitle });
                    const linkTextNode = $createTextNode(linkText);
                    linkTextNode.setFormat(textNode.getFormat());
                    linkNode.append(linkTextNode);
                    textNode.replace(linkNode);

                    return linkTextNode;
                },
                trigger: ')',
                type: 'text-match',
            });
        }
    }