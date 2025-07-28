import { KernelPlugin } from "@/editor-kernel/plugin";
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from "@/editor-kernel/types";
import { IMarkdownShortCutService } from "@/plugins/markdown";
import { CodeNode } from "@lexical/code";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface CodeblockPluginOptions { }

export const CodeblockPlugin: IEditorPluginConstructor<CodeblockPluginOptions> =
    class extends KernelPlugin implements IEditorPlugin<CodeblockPluginOptions> {
        static pluginName = "CodeblockPlugin";

        constructor(protected kernel: IEditorKernel) {
            super();
            // Register the code block plugin
            kernel.registerNodes([CodeNode])
            kernel.requireService(IMarkdownShortCutService)?.registerMarkdownShortCut({
                format: ['bold'],
                tag: '**',
                type: 'text-format',
            });
            kernel.requireService(IMarkdownShortCutService)?.registerMarkdownShortCut({
                format: ['code'],
                tag: '`',
                type: 'text-format',
            });
        }
    }
