import type { IEditor } from '@/types';

import { Kernel } from './kernel';

export { default as DataSource } from './data-source';
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
