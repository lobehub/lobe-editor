import { EditorState, LexicalEditor, RootNode } from "lexical";
import DataSource from "../data-source";

export function createEmptyEditorState(): EditorState {
    return new EditorState(new Map([['root', new RootNode()]]));
}

export default class JSONDataSource extends DataSource {
    constructor(dataType: string) {
        super(dataType);
    }

    read(editor: LexicalEditor, data: any) {
        editor.setEditorState(editor.parseEditorState(data));
    }

    write(editor: LexicalEditor): any {
        return editor.getEditorState().toJSON();
    }
}
