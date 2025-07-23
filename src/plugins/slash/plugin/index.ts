import { $getSelection, $isRangeSelection, LexicalEditor } from "lexical";
import type { IEditorKernel, IEditorPlugin } from "@/editor-kernel";
import { getQueryTextForSearch, tryToPositionRange } from "../utils/utils";
import { ISlashService, SlashService } from "../service/i-slash-service";
import EventEmitter from "eventemitter3";
import { IEditorPluginConstructor } from "@/editor-kernel/types";

export interface SlashPluginOptions {
    name: string;
}

export const SlashPlugin: IEditorPluginConstructor<SlashPluginOptions> =
    class extends EventEmitter implements IEditorPlugin<SlashPluginOptions> {
        static readonly pluginName = 'slash'

        private service: SlashService | null = null;

        constructor(kernel: IEditorKernel, config?: SlashPluginOptions) {
            super();
            this.service = new SlashService(kernel);
            kernel.registerService(ISlashService, this.service);
        }

        onRegister(editor: LexicalEditor): Array<() => void> {
            return [editor.registerUpdateListener(() => {
                console.trace('SlashPlugin: Editor updated');
                editor.getEditorState().read(() => {
                    if (!editor.isEditable()) {
                        // 触发关闭
                        this.emit('close');
                        return;
                    }

                    const editorWindow = editor._window || window;
                    const range = editorWindow.document.createRange();
                    const selection = $getSelection();
                    const text = getQueryTextForSearch(editor);

                    if (
                        !$isRangeSelection(selection) ||
                        !selection.isCollapsed() ||
                        text === null ||
                        range === null
                    ) {
                        // 触发关闭
                        this.emit('close');
                        return;
                    }

                    const slashOptions = this.service?.getSlashOptions(text[0]);
                    if (!slashOptions) {
                        // 触发关闭
                        this.emit('close');
                        return;
                    }

                    const isRangePositioned = tryToPositionRange(0, range, editorWindow);
                    if (isRangePositioned !== null) {
                        this.emit('open', {
                            getRect: () => range.getBoundingClientRect(),
                            items: slashOptions.items,
                        });
                        return;
                    }
                    this.emit('close');
                });
            })]
        }

        onDestroy(): void {
        }
    };
