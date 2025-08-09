import { Kernel } from './kernel';
import { IEditor } from './types';

export { default as DataSource } from './data-source';
export type { IEditor, IEditorKernel, IEditorPlugin, IServiceID } from './types';
export * from './utils';

/**
 * Editor object to create an instance of the editor
 */
const Editor = {
  createEditor(): IEditor {
    return new Kernel();
  },
};

export default Editor;

export { HOVER_COMMAND } from './event';
