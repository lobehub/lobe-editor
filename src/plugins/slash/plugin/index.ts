import { $getSelection, $isRangeSelection, LexicalEditor } from "lexical";
import type { IEditorKernel, IEditorPlugin } from "@/editor-kernel";
import { getQueryTextForSearch } from "../utils/utils";
import { ISlashService, SlashService } from "../service/i-slash-service";

export default class SlashPlugin implements IEditorPlugin {
    readonly name = 'slash'

    onInit(kernel: IEditorKernel): void {
        kernel.registerService(ISlashService, new SlashService(kernel));
    }

    onRegister(editor: LexicalEditor): Array<() => void> {
        return [editor.registerUpdateListener(() => {
            console.trace('SlashPlugin: Editor updated');
            editor.getEditorState().read(() => {
                if (!editor.isEditable()) {
                    // 触发关闭
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
                    return;
                }

                console.info(getQueryTextForSearch(editor));
            });
        })]
    }

    onDestroy(): void {
    }
}
