/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable unused-imports/no-unused-vars */
import { LexicalEditor } from "lexical";

export default class DataSource {
    constructor(protected dataType: string) {}

    public get type() {
        return this.dataType
    }

    read(editor: LexicalEditor, data: any) {}

    write(editor: LexicalEditor): any {
        return null; 
    }
}
