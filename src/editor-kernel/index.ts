import { Kernel } from "./kernel";
import { IEditor } from "./types";

export type { IEditor, IEditorKernel, IEditorPlugin, IServiceID } from "./types";

export { default as DataSource } from "./data-source";

export * from "./utils";

/**
 * Editor class to create an instance of the editor
 */
export default class Editor {
    static createEditor(): IEditor {
        return new Kernel();
    }
}
