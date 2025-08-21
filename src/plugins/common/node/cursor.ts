import { $createTextNode, $getSelection, $isRangeSelection, COMMAND_PRIORITY_HIGH, KEY_BACKSPACE_COMMAND, LexicalEditor, TextNode } from "lexical";
import { mergeRegister } from '@lexical/utils';


export class CursorNode extends TextNode {
    static getType(): string {
        return 'cursor';
    }

    override isUnmergeable(): boolean {
        return true;
    }
}

export function $createCursorNode(): CursorNode {
    return new CursorNode('\uFEFF');
}

export function registerCursorNode(editor: LexicalEditor) {
    return mergeRegister(
        editor.registerUpdateListener(() => {
            editor.read(() => {
                const selection = $getSelection();
                if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
                    return false;
                }
                const node = selection.anchor.getNode();
                if (node instanceof CursorNode) {
                    if (node.__text !== '\uFEFF') {
                        editor.update(() => {
                            node.setTextContent('\uFEFF');
                            const data = node.__text.replace('\uFEFF', '');
                            if (data) {
                                const textNode = $createTextNode(data);
                                node.insertAfter(textNode);
                                textNode.selectEnd();
                            }
                        });
                    }
                    return false;
                }
            });
        }),
        editor.registerCommand(
            KEY_BACKSPACE_COMMAND,
            (event) => {
                const selection = $getSelection();
                if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
                    return false;
                }
                const node = selection.anchor.getNode();
                if (node instanceof CursorNode) {
                    event.preventDefault();
                    const prev = node.getPreviousSibling();
                    const parent = node.getParent();
                    const parentPrev = parent?.getPreviousSibling();
                    let needDispatch = false;
                    if (prev) {
                        prev.selectEnd();
                        needDispatch = true;
                    } else if (parent) {
                        if (parent.getChildrenSize() === 1) {
                            parent.remove();
                        } else if (parentPrev) {
                            parentPrev.selectEnd();
                            needDispatch = true;
                        }
                    }
                    if (needDispatch) {
                        queueMicrotask(() => {
                            editor.dispatchCommand(KEY_BACKSPACE_COMMAND, event);
                        });
                    }
                    return true;
                }
                return false;
            },
            COMMAND_PRIORITY_HIGH,
        ),
    );
}
